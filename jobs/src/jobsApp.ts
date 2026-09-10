import type {TerrenoPlugin} from "@terreno/api";
import {logger} from "@terreno/api";
import type express from "express";

import {JobsService, registerJobsService} from "./jobsService";
import {Job} from "./models/job";
import {MongoJobRunner} from "./runners/mongoRunner";
import type {JobDefinition, JobRunner} from "./types";

export interface JobsAppOptions {
  basePath?: string;
  lockTtlMs?: number;
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
  private workerActive = false;
  private abortController: AbortController | undefined;

  constructor(options?: JobsAppOptions) {
    this.options = options ?? {};
    this.runner = this.options.runner ?? new MongoJobRunner();
    this.service = new JobsService({lockTtlMs: this.options.lockTtlMs});
  }

  define(name: string, definition: JobDefinition): this {
    this.service.define(name, definition);
    return this;
  }

  getBasePath(): string {
    return this.options.basePath ?? "/jobs";
  }

  getDefinition(name: string): JobDefinition | undefined {
    return this.service.getDefinition(name);
  }

  getLockTtlMs(): number {
    return this.service.getLockTtlMs();
  }

  register(_app: express.Application, _openApi?: unknown): void {
    registerJobsService(this.service);

    void Job.init().catch((error: unknown) => {
      logger.error(`[jobs] Failed to build Job indexes: ${String(error)}`);
    });
  }

  isWorkerActive(): boolean {
    return this.workerActive;
  }

  async startWorker(): Promise<void> {
    if (this.workerActive) {
      return;
    }

    this.workerActive = true;
    this.abortController = new AbortController();

    if (!this.runner.start) {
      this.workerActive = false;
      this.abortController = undefined;
      throw new Error(`Job runner "${this.runner.id}" does not support start()`);
    }

    try {
      await this.runner.start({
        jobs: this,
        signal: this.abortController.signal,
      });
    } catch (error: unknown) {
      this.workerActive = false;
      this.abortController = undefined;
      throw error;
    }
  }

  async stopWorker(): Promise<void> {
    this.abortController?.abort();
    await this.runner.stop?.();
    this.workerActive = false;
    this.abortController = undefined;
  }
}
