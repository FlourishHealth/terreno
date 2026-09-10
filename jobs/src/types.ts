import type {ScopedLogger} from "@terreno/api";

import type {JobDocument} from "./modelTypes";

export interface JobHandlerContext {
  jobId: string;
  log: ScopedLogger;
  signal: AbortSignal;
}

export interface JobDefinition {
  handler: (payload: unknown, ctx: JobHandlerContext) => Promise<void>;
  retry?: {
    backoffMs?: number;
    maxAttempts?: number;
    maxBackoffMs?: number;
  };
}

export interface EnqueueJobParams {
  idempotencyKey?: string;
  name: string;
  payload: unknown;
  runAt?: Date;
}

export interface JobRunnerStartOptions {
  jobs: JobsRunnerHost;
  signal: AbortSignal;
}

export interface JobsRunnerHost {
  getDefinition(name: string): JobDefinition | undefined;
  getLockTtlMs(): number;
}

export interface JobRunner {
  readonly id: string;
  enqueue(job: JobDocument): Promise<void>;
  start?(options: JobRunnerStartOptions): Promise<void>;
  stop?(): Promise<void>;
}
