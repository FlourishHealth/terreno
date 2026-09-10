import os from "node:os";
import {APIError, createScopedLogger, runWithRequestContext} from "@terreno/api";
import {DateTime} from "luxon";

import {Job} from "../models/job";
import type {JobDocument} from "../modelTypes";
import type {JobRunner, JobRunnerStartOptions} from "../types";

const WORKER_ID = `${os.hostname()}:${process.pid}`;

const buildLockExpiry = (lockTtlMs: number): Date =>
  DateTime.utc().minus({milliseconds: lockTtlMs}).toJSDate();

export class MongoJobRunner implements JobRunner {
  readonly id = "mongo";

  async enqueue(_job: JobDocument): Promise<void> {
    // Mongo persistence happens before dispatch; the poller picks up the row.
  }

  async start(options: JobRunnerStartOptions): Promise<void> {
    while (!options.signal.aborted) {
      const processed = await this.processNext(options);
      if (!processed) {
        break;
      }
    }
  }

  private async processNext(options: JobRunnerStartOptions): Promise<boolean> {
    const now = DateTime.utc().toJSDate();
    const lockExpiry = buildLockExpiry(options.jobs.getLockTtlMs());

    const claimed = await Job.findOneAndUpdate(
      {
        $or: [{lockedAt: {$exists: false}}, {lockedAt: null}, {lockedAt: {$lte: lockExpiry}}],
        runAt: {$lte: now},
        status: {$in: ["pending", "scheduled"]},
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

  private async executeClaimedJob(job: JobDocument, options: JobRunnerStartOptions): Promise<void> {
    const definition = options.jobs.getDefinition(job.name);
    if (!definition) {
      const message = `No handler registered for job name "${job.name}"`;
      job.lastError = message;
      job.status = "failed";
      await job.save();
      throw new APIError({status: 500, title: message});
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
      job.lastError = error instanceof Error ? error.message : String(error);
      job.status = "failed";
      await job.save();
      throw error;
    }
  }
}
