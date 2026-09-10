import {logger} from "@terreno/api";

import {JobDispatchError} from "./dispatchError";
import {Job} from "./models/job";
import type {JobDocument} from "./modelTypes";
import type {JobRunner} from "./types";

export const removeUntouchedPendingJob = async (jobId: JobDocument["_id"]): Promise<boolean> => {
  const removed = await Job.findOneAndDelete({
    _id: jobId,
    $and: [
      {$or: [{lockedAt: {$exists: false}}, {lockedAt: null}]},
      {$or: [{lockedBy: {$exists: false}}, {lockedBy: null}]},
    ],
    attemptCount: 0,
    status: "pending",
  });

  return removed !== null;
};

export const dispatchJobToRunner = async (runner: JobRunner, job: JobDocument): Promise<void> => {
  try {
    await runner.enqueue(job);
  } catch (error: unknown) {
    const compensationSucceeded = await removeUntouchedPendingJob(job._id);
    if (!compensationSucceeded) {
      logger.error(
        `[jobs] Dispatch failed for job ${job._id.toString()} and compensation lost race — row was already claimed or mutated`
      );
    }

    throw new JobDispatchError({
      cause: error,
      compensationSucceeded,
      jobId: job._id.toString(),
    });
  }
};
