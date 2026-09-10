import type {TerrenoPlugin} from "@terreno/api";
import type express from "express";

export interface JobsAppOptions {
  basePath?: string;
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
  private workerActive = false;

  constructor(options?: JobsAppOptions) {
    this.options = options ?? {};
  }

  getBasePath(): string {
    return this.options.basePath ?? "/jobs";
  }

  register(_app: express.Application, _openApi?: unknown): void {
    // Routes, models, and service wiring land in later tasks.
  }

  isWorkerActive(): boolean {
    return this.workerActive;
  }

  async startWorker(): Promise<void> {
    this.workerActive = true;
  }

  async stopWorker(): Promise<void> {
    this.workerActive = false;
  }
}
