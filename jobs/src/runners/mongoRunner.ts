import os from "node:os";
import {createScopedLogger, runWithRequestContext} from "@terreno/api";
import {DateTime} from "luxon";

import {Job} from "../models/job";
import type {JobDocument} from "../modelTypes";
import type {JobRunner, JobRunnerStartOptions} from "../types";

const DEFAULT_POLL_INTERVAL_MS = 1_000;

const WORKER_ID = `${os.hostname()}:${process.pid}`;

export const getWorkerId = (): string => WORKER_ID;

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

    const claimed = await Job.findOneAndUpdate(
      {
        $or: [{lockedAt: {$exists: false}}, {lockedAt: null}, {lockedAt: {$lte: lockExpiry}}],
        runAt: {$lte: now},
        status: {$in: ["pending", "running", "scheduled"]},
      },
      {
        $set: {
          lockedAt: now,
          lockedBy: WORKER_ID,
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

  private async releaseLockToPending(jobId: JobDocument["_id"]): Promise<void> {
    await Job.updateOne(
      {_id: jobId},
      {
        $set: {status: "pending"},
        $unset: {lockedAt: "", lockedBy: ""},
      }
    );
  }

  private async executeClaimedJob(job: JobDocument, options: JobRunnerStartOptions): Promise<void> {
    const definition = options.jobs.getDefinition(job.name);
    if (!definition) {
      const message = `No handler registered for job name "${job.name}"`;
      job.lastError = message;
      job.status = "failed";
      await job.save();
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

      job.status = "completed";
      job.lastError = undefined;
      await job.save();
    } catch (error: unknown) {
      if (options.signal.aborted) {
        await this.releaseLockToPending(job._id);
        return;
      }

      job.lastError = error instanceof Error ? error.message : String(error);
      job.status = "failed";
      await job.save();
    }
  }
}
