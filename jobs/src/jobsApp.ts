import type {TerrenoPlugin} from "@terreno/api";
import {logger} from "@terreno/api";
import type express from "express";

import {JobsService, registerJobsService} from "./jobsService";
import {Job} from "./models/job";
import {JobSchedule} from "./models/jobSchedule";
import {MongoJobRunner} from "./runners/mongoRunner";
import type {JobDefinition, JobRunner} from "./types";

export interface JobsAppOptions {
  basePath?: string;
  lockTtlMs?: number;
  pollIntervalMs?: number;
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
export class JobsApp implements TerrenoPlugin {
  private readonly options: JobsAppOptions;
  private readonly runner: JobRunner;
  private readonly service: JobsService;
  private abortController: AbortController | undefined;
  private workerActive = false;
  private workerPromise: Promise<void> | undefined;

  constructor(options?: JobsAppOptions) {
    this.options = options ?? {};
    this.runner = this.options.runner ?? new MongoJobRunner();
    this.service = new JobsService({
      defaultTimezone: this.options.timezone ?? "UTC",
      lockTtlMs: this.options.lockTtlMs,
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

  register(_app: express.Application, _openApi?: unknown): void {
    registerJobsService(this.service);

    void Job.init().catch((error: unknown) => {
      logger.error(`[jobs] Failed to build Job indexes: ${String(error)}`);
    });

    void JobSchedule.init().catch((error: unknown) => {
      logger.error(`[jobs] Failed to build JobSchedule indexes: ${String(error)}`);
    });
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

    if (!this.runner.start) {
      throw new Error(`Job runner "${this.runner.id}" does not support start()`);
    }

    await this.service.reconcileSchedules();

    this.workerActive = true;
    this.abortController = new AbortController();

    this.workerPromise = this.runner
      .start({
        jobs: this,
        pollIntervalMs: this.getPollIntervalMs(),
        signal: this.abortController.signal,
      })
      .catch((error: unknown) => {
        this.workerActive = false;
        this.abortController = undefined;
        this.workerPromise = undefined;
        logger.error(`[jobs] Worker stopped with error: ${String(error)}`);
      });
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

    this.workerActive = false;
    this.abortController = undefined;
    this.workerPromise = undefined;
  }
}
