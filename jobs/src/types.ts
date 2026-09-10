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
  /** Host surface passed to runners so they can resolve handlers and schedules without importing internals. */
  jobs: JobsRunnerHost;
  pollIntervalMs?: number;
  signal: AbortSignal;
}

/** Public host surface for {@link JobRunner.start} — implemented by {@link JobsApp}. */
export interface JobsRunnerHost {
  getDefaultTimezone(): string;
  getDefinition(name: string): JobDefinition | undefined;
  getLockTtlMs(): number;
  reconcileSchedules(): Promise<void>;
  reconcileSchedulesIfDirty(): Promise<void>;
  tickSchedules(now?: Date): Promise<void>;
}

/**
 * Pluggable job dispatch and worker lifecycle.
 *
 * {@link enqueue} is invoked only after a **new** job row is persisted; idempotent
 * dedupe returns the existing row without redispatching. {@link MongoJobRunner} is
 * the default — its {@link enqueue} is a no-op because the poll loop claims Mongo rows.
 */
export interface JobRunner {
  readonly id: string;
  /** When true, {@link JobsApp} mounts the internal execute HTTP route (requires {@link JobsAppOptions.executeAuth}). */
  readonly requiresExecuteRoute?: boolean;
  enqueue(job: JobDocument): Promise<void>;
  start?(options: JobRunnerStartOptions): Promise<void>;
  stop?(): Promise<void>;
}
