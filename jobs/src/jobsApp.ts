import {
  type AdminContribution,
  type AnyTerrenoAccess,
  logger,
  type TerrenoPlugin,
} from "@terreno/api";
import type express from "express";

import {type ExecuteJobOutcome, executeJobById} from "./jobExecutor";
import {JobsService, registerJobsService} from "./jobsService";
import {Job} from "./models/job";
import {JobSchedule} from "./models/jobSchedule";
import {registerJobsAdminRoutes} from "./routes/jobsAdmin";
import {type ExecuteAuthVerifier, registerJobsExecuteRoute} from "./routes/jobsExecute";

export type {JobsAdminPayloadViewInput, JobsAdminRedactPayload} from "./types";
export type {ExecuteAuthVerifier};

import {MongoJobRunner} from "./runners/mongoRunner";
import type {JobDefinition, JobRunner, JobsAdminRedactPayload, JobsRunnerHost} from "./types";

export interface JobsAppOptions {
  accessControl?: AnyTerrenoAccess;
  basePath?: string;
  /** Verifies inbound execute HTTP requests (required when the execute route is mounted). */
  executeAuth?: ExecuteAuthVerifier;
  lockTtlMs?: number;
  /** Mount internal `POST {basePath}/execute` for cloud/custom dispatch. */
  mountExecuteRoute?: boolean;
  pollIntervalMs?: number;
  /** Admin list/detail payload projection. Default omits payload; identity hook may expose raw payload. */
  redactPayload?: JobsAdminRedactPayload;
  runner?: JobRunner;
  timezone?: string;
}

/**
 * TerrenoPlugin for durable background jobs.
 *
 * Registering `JobsApp` wires the plugin into the Express app but does **not**
 * start a worker poll loop. Call {@link JobsApp.startWorker} explicitly from the
 * API process or a dedicated worker entrypoint.
 */
export class JobsApp implements JobsRunnerHost, TerrenoPlugin {
  private readonly options: JobsAppOptions;
  private readonly runner: JobRunner;
  private readonly service: JobsService;
  private abortController: AbortController | undefined;
  private workerActive = false;
  private workerPromise: Promise<void> | undefined;
  private workerStartPromise: Promise<void> | undefined;

  constructor(options?: JobsAppOptions) {
    this.options = options ?? {};
    this.runner = this.options.runner ?? new MongoJobRunner();
    this.service = new JobsService({
      defaultTimezone: this.options.timezone ?? "UTC",
      lockTtlMs: this.options.lockTtlMs,
      runner: this.runner,
    });
  }

  define(name: string, definition: JobDefinition): this {
    this.service.define(name, definition);
    if (this.workerActive && definition.schedule) {
      this.service.markSchedulesDirty();
    }
    return this;
  }

  getBasePath(): string {
    return this.options.basePath ?? "/jobs";
  }

  getDefinition(name: string): JobDefinition | undefined {
    return this.service.getDefinition(name);
  }

  getDefaultTimezone(): string {
    return this.service.getDefaultTimezone();
  }

  getLockTtlMs(): number {
    return this.service.getLockTtlMs();
  }

  /** Execute a persisted job by id from an external dispatch surface (queue consumer, execute HTTP). */
  async executeQueuedJob(
    jobId: string,
    signal: AbortSignal = AbortSignal.timeout(30 * 60 * 1_000)
  ): Promise<ExecuteJobOutcome> {
    return executeJobById({
      host: this,
      jobId,
      signal,
    });
  }

  getPollIntervalMs(): number {
    return this.options.pollIntervalMs ?? 1_000;
  }

  async reconcileSchedules(): Promise<void> {
    await this.service.reconcileSchedules();
  }

  async reconcileSchedulesIfDirty(): Promise<void> {
    await this.service.reconcileSchedulesIfDirty();
  }

  async tickSchedules(now?: Date): Promise<void> {
    await this.service.tickSchedules(now);
  }

  register(app: express.Application, openApi?: unknown): void {
    registerJobsService(this.service);

    registerJobsAdminRoutes({
      app,
      options: {
        accessControl: this.options.accessControl,
        basePath: this.getBasePath(),
        jobsService: this.service,
        openApi,
        redactPayload: this.options.redactPayload,
      },
    });

    if (this.shouldMountExecuteRoute()) {
      if (!this.options.executeAuth) {
        throw new Error(
          "JobsApp execute route is enabled but executeAuth is missing. Provide executeAuth when mountExecuteRoute is true or the runner requires the execute route."
        );
      }

      registerJobsExecuteRoute({
        app,
        options: {
          basePath: this.getBasePath(),
          executeAuth: this.options.executeAuth,
          host: this.service,
        },
      });
    }

    void Job.init().catch((error: unknown) => {
      logger.error(`[jobs] Failed to build Job indexes: ${String(error)}`);
    });

    void JobSchedule.init().catch((error: unknown) => {
      logger.error(`[jobs] Failed to build JobSchedule indexes: ${String(error)}`);
    });
  }

  adminContribution(): AdminContribution {
    return {
      customScreens: [
        {
          displayName: "Jobs",
          icon: "clock",
          name: "jobs",
        },
      ],
      homeWidgets: [{displayName: "Jobs", icon: "clock", id: "jobs"}],
    };
  }

  private shouldMountExecuteRoute(): boolean {
    if (this.options.mountExecuteRoute) {
      return true;
    }

    return this.runner.requiresExecuteRoute === true;
  }

  isWorkerActive(): boolean {
    return this.workerActive;
  }

  /**
   * Starts the background worker poll loop without awaiting it.
   *
   * Fire-and-forget: resolves once the runner has been scheduled. Runner errors are
   * logged and worker state is reset; they are not thrown from this method.
   */
  async startWorker(): Promise<void> {
    if (this.workerActive) {
      return;
    }

    if (this.workerStartPromise !== undefined) {
      await this.workerStartPromise;
      return;
    }

    this.workerStartPromise = this.beginWorkerStart();
    try {
      await this.workerStartPromise;
    } finally {
      this.workerStartPromise = undefined;
    }
  }

  async stopWorker(): Promise<void> {
    if (!this.workerActive) {
      return;
    }

    const stopPromise = this.runner.stop?.();
    this.abortController?.abort();

    try {
      await this.workerPromise;
    } catch {
      // startWorker is fire-and-forget; runner errors are logged in workerPromise.catch.
    }

    await stopPromise;

    this.resetWorkerState();
  }

  private resetWorkerState(): void {
    this.workerActive = false;
    this.abortController = undefined;
    this.workerPromise = undefined;
  }

  private async beginWorkerStart(): Promise<void> {
    if (this.workerActive) {
      return;
    }

    if (!this.runner.start) {
      throw new Error(`Job runner "${this.runner.id}" does not support start()`);
    }

    this.workerActive = true;

    try {
      await this.service.reconcileSchedules();

      this.abortController = new AbortController();
      this.workerPromise = this.runner
        .start({
          jobs: this,
          pollIntervalMs: this.getPollIntervalMs(),
          signal: this.abortController.signal,
        })
        .catch((error: unknown) => {
          this.resetWorkerState();
          logger.error(`[jobs] Worker stopped with error: ${String(error)}`);
        });
    } catch (error: unknown) {
      this.resetWorkerState();
      throw error;
    }
  }
}
