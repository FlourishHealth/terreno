export class JobDispatchError extends Error {
  readonly cause: unknown;
  readonly compensationSucceeded: boolean;
  readonly jobId: string;

  constructor(options: {cause: unknown; compensationSucceeded: boolean; jobId: string}) {
    const detail = options.cause instanceof Error ? options.cause.message : String(options.cause);
    super(`Job dispatch failed for ${options.jobId}: ${detail}`);
    this.name = "JobDispatchError";
    this.cause = options.cause;
    this.compensationSucceeded = options.compensationSucceeded;
    this.jobId = options.jobId;
  }
}
