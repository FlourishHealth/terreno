import {randomUUID} from "node:crypto";
import os from "node:os";

import type {JobDocument} from "./modelTypes";

export const getWorkerId = (): string => `${os.hostname()}:${process.pid}`;

export interface JobClaimLock {
  lockedAt: Date;
  lockedBy: string;
}

export const createClaimLock = (lockedAt: Date): JobClaimLock => ({
  lockedAt,
  lockedBy: `${getWorkerId()}:${randomUUID()}`,
});

export const buildClaimOwnershipFilter = (
  jobId: JobDocument["_id"],
  claim: JobClaimLock
): {_id: JobDocument["_id"]; lockedAt: Date; lockedBy: string} => ({
  _id: jobId,
  lockedAt: claim.lockedAt,
  lockedBy: claim.lockedBy,
});

export const hasWorkerIdPrefix = (lockedBy: string | undefined): boolean => {
  if (!lockedBy) {
    return false;
  }
  return lockedBy.startsWith(`${getWorkerId()}:`);
};

export const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === "AbortError";
