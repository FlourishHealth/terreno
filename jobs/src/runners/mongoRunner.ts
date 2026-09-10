import {createScopedLogger, runWithRequestContext} from "@terreno/api";
import {DateTime} from "luxon";

import {
  buildClaimOwnershipFilter,
  createClaimLock,
  isAbortError,
  type JobClaimLock,
} from "../claimLock";
import {Job} from "../models/job";
import type {JobAttempt, JobDocument} from "../modelTypes";
import {computeRetryRunAt} from "../retryBackoff";
import type {JobRunner, JobRunnerStartOptions} from "../types";

const DEFAULT_POLL_INTERVAL_MS = 1_000;

export {getWorkerId, hasWorkerIdPrefix} from "../claimLock";

const buildLockExpiry = (lockTtlMs: number): Date =>
  DateTime.utc().minus({milliseconds: lockTtlMs}).toJSDate();

const waitForAbortOrTimeout = (signal: AbortSignal, timeoutMs: number): Promise<void> =>
  new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, timeoutMs);

    const onAbort = (): void => {
      clearTimeout(timer);
      resolve();
    };

    signal.addEventListener("abort", onAbort, {once: true});
  });

const readClaimLock = (job: JobDocument): JobClaimLock => {
  if (!job.lockedAt || !job.lockedBy) {
    throw new Error(`Job ${job._id.toString()} is missing claim lock metadata`);
  }

  return {
    lockedAt: job.lockedAt,
    lockedBy: job.lockedBy,
  };
};

export class MongoJobRunner implements JobRunner {
  readonly id = "mongo";
  private pollIntervalMs = DEFAULT_POLL_INTERVAL_MS;
  private running = false;
  private stopResolve: (() => void) | undefined;

  async enqueue(_job: JobDocument): Promise<void> {
    // Mongo persistence happens before dispatch; the poller picks up the row.
  }

  async start(options: JobRunnerStartOptions): Promise<void> {
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.running = true;

    try {
      while (!options.signal.aborted) {
        await options.jobs.reconcileSchedulesIfDirty();
        await options.jobs.tickSchedules();

        let processedAny = false;

        while (!options.signal.aborted) {
          const processed = await this.processNext(options);
          if (!processed) {
            break;
          }
          processedAny = true;
        }

        if (options.signal.aborted) {
          break;
        }

        if (!processedAny) {
          await waitForAbortOrTimeout(options.signal, this.pollIntervalMs);
        }
      }
    } finally {
      this.running = false;
      this.stopResolve?.();
      this.stopResolve = undefined;
    }
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    await new Promise<void>((resolve) => {
      this.stopResolve = resolve;
    });
  }

  private async processNext(options: JobRunnerStartOptions): Promise<boolean> {
    const now = DateTime.utc().toJSDate();
    const lockExpiry = buildLockExpiry(options.jobs.getLockTtlMs());
    const claim = createClaimLock(now);

    const claimed = await Job.findOneAndUpdate(
      {
        $or: [{lockedAt: {$exists: false}}, {lockedAt: null}, {lockedAt: {$lte: lockExpiry}}],
        runAt: {$lte: now},
        status: {$in: ["pending", "running", "scheduled"]},
      },
      {
        $set: {
          lockedAt: claim.lockedAt,
          lockedBy: claim.lockedBy,
          status: "running",
        },
      },
      {returnDocument: "after", sort: {runAt: 1}}
    );

    if (!claimed) {
      return false;
    }

    await this.executeClaimedJob(claimed, options);
    return true;
  }

  private async releaseLockToPending(
    jobId: JobDocument["_id"],
    claim: JobClaimLock
  ): Promise<void> {
    await Job.updateOne(buildClaimOwnershipFilter(jobId, claim), {
      $set: {status: "pending"},
      $unset: {lockedAt: "", lockedBy: ""},
    });
  }

  private async recordHandlerSuccess(
    jobId: JobDocument["_id"],
    claim: JobClaimLock
  ): Promise<void> {
    await Job.updateOne(buildClaimOwnershipFilter(jobId, claim), {
      $set: {lastError: undefined, status: "completed"},
    });
  }

  private async recordHandlerFailure(
    job: JobDocument,
    error: unknown,
    options: JobRunnerStartOptions,
    claim: JobClaimLock
  ): Promise<void> {
    if (options.signal.aborted && isAbortError(error)) {
      await this.releaseLockToPending(job._id, claim);
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorClass = error instanceof Error ? error.name : "Error";
    const attemptedAt = DateTime.utc().toJSDate();
    const attemptEntry: JobAttempt = {
      at: attemptedAt,
      error: errorMessage,
      errorClass,
    };
    const nextAttemptCount = job.attemptCount + 1;
    const ownershipFilter = buildClaimOwnershipFilter(job._id, claim);

    if (nextAttemptCount >= job.maxAttempts) {
      await Job.updateOne(ownershipFilter, {
        $push: {attempts: attemptEntry},
        $set: {
          attemptCount: nextAttemptCount,
          lastError: errorMessage,
          status: "dead",
        },
        $unset: {lockedAt: "", lockedBy: ""},
      });
      return;
    }

    const runAt = computeRetryRunAt({
      attemptCount: nextAttemptCount,
      backoffMs: job.backoffMs,
      from: DateTime.utc(),
      maxBackoffMs: job.maxBackoffMs,
    }).toJSDate();

    await Job.updateOne(ownershipFilter, {
      $push: {attempts: attemptEntry},
      $set: {
        attemptCount: nextAttemptCount,
        lastError: errorMessage,
        runAt,
        status: "pending",
      },
      $unset: {lockedAt: "", lockedBy: ""},
    });
  }

  private async recordMissingHandlerFailure(
    job: JobDocument,
    message: string,
    claim: JobClaimLock
  ): Promise<void> {
    await Job.updateOne(buildClaimOwnershipFilter(job._id, claim), {
      $set: {
        lastError: message,
        status: "failed",
      },
    });
  }

  private async executeClaimedJob(job: JobDocument, options: JobRunnerStartOptions): Promise<void> {
    const claim = readClaimLock(job);
    const definition = options.jobs.getDefinition(job.name);
    if (!definition) {
      const message = `No handler registered for job name "${job.name}"`;
      await this.recordMissingHandlerFailure(job, message, claim);
      return;
    }

    const log = createScopedLogger({
      labels: {jobId: job._id.toString(), jobName: job.name},
      prefix: "[Job]",
    });

    try {
      await runWithRequestContext({jobId: job._id.toString()}, async () => {
        await definition.handler(job.payload, {
          jobId: job._id.toString(),
          log,
          signal: options.signal,
        });
      });

      await this.recordHandlerSuccess(job._id, claim);
    } catch (error: unknown) {
      await this.recordHandlerFailure(job, error, options, claim);
    }
  }
}
