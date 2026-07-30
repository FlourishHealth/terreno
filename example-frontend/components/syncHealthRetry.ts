/**
 * Helpers for the sync-health Retry action: find failed outbox entities in a
 * collection, and decide whether a retry attempt succeeded or should surface an
 * error toast.
 */
import type {SyncStatus} from "@terreno/syncdb";

export const RETRY_ERROR_TOAST_ID = "sync-health-retry-error";

export interface FailedOutboxRow {
  status?: string;
  entityId?: string;
  collection?: string;
}

/**
 * Collects entity ids for terminally-failed outbox rows in `collection`, so
 * Retry can call `retryFailed` once per entity.
 */
export const failedEntityIdsForCollection = ({
  collection,
  outboxRows,
}: {
  collection: string;
  outboxRows: Record<string, unknown>;
}): string[] => {
  const entityIds = new Set<string>();
  for (const row of Object.values(outboxRows)) {
    const typed = row as FailedOutboxRow;
    if (typed.status === "failed" && typed.collection === collection && typed.entityId) {
      entityIds.add(typed.entityId);
    }
  }
  return [...entityIds];
};

export type RetryBlockedReason = "auth" | "offline";

/**
 * Preconditions that make a retry a no-op (replayOutbox returns without
 * draining). Callers should toast these instead of reporting success.
 */
export const getRetryBlockedReason = (status: SyncStatus): RetryBlockedReason | null => {
  if (status.paused === "auth") {
    return "auth";
  }
  if (!status.isOnline) {
    return "offline";
  }
  return null;
};

export const retryBlockedMessage = ({
  reason,
  label,
  phase,
}: {
  reason: RetryBlockedReason;
  label: string;
  /** "before" = couldn't start; "after" = interrupted mid-retry. */
  phase: "before" | "after";
}): string => {
  if (reason === "auth") {
    return phase === "before"
      ? `Couldn't retry ${label} — sign in again to sync.`
      : `Retry of ${label} paused — sign in again to finish syncing.`;
  }
  return phase === "before"
    ? `Couldn't retry ${label} — you're offline.`
    : `Retry of ${label} interrupted — you're offline.`;
};

export const nothingToRetryMessage = (label: string): string =>
  `Couldn't retry — no failed ${label} changes found.`;

export const retryFailedMessage = (label: string): string => `Couldn't retry ${label} sync`;
