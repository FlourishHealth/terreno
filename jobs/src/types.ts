import type {ScopedLogger} from "@terreno/api";

import type {JobDocument} from "./modelTypes";

export interface JobHandlerContext {
  jobId: string;
  log: ScopedLogger;
  signal: AbortSignal;
}

export interface JobScheduleDefinition {
  cron: string;
  timezone?: string;
}

export interface JobDefinition {
  handler: (payload: unknown, ctx: JobHandlerContext) => Promise<void>;
  retry?: {
    backoffMs?: number;
    maxAttempts?: number;
    maxBackoffMs?: number;
  };
  schedule?: JobScheduleDefinition;
}

export interface EnqueueJobParams {
  idempotencyKey?: string;
  name: string;
  payload: unknown;
  runAt?: Date;
  scheduleId?: string;
}

export interface JobRunnerStartOptions {
  jobs: JobsRunnerHost;
  pollIntervalMs?: number;
  signal: AbortSignal;
}

export interface JobsRunnerHost {
  getDefaultTimezone(): string;
  getDefinition(name: string): JobDefinition | undefined;
  getLockTtlMs(): number;
  reconcileSchedules(): Promise<void>;
  reconcileSchedulesIfDirty(): Promise<void>;
  tickSchedules(now?: Date): Promise<void>;
}

export interface JobRunner {
  readonly id: string;
  enqueue(job: JobDocument): Promise<void>;
  start?(options: JobRunnerStartOptions): Promise<void>;
  stop?(): Promise<void>;
}
