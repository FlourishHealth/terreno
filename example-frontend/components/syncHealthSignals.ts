/**
 * Maps a {@link SyncStatus} to the set of health toasts that should be on screen.
 *
 * There is one toast per collection that needs a human (unresolved conflicts or
 * changes that failed to sync), each naming the collection so the user knows what
 * is affected, plus at most one collection-agnostic toast for a backlog that is
 * drifting out of sync. Toast ids are derived from the collection, so a
 * collection can never accumulate more than one toast however its counts change.
 *
 * Kept free of React and UI imports so it can be unit tested directly.
 */
import type {SyncStatus} from "@terreno/syncdb";

/**
 * Queue depth (while online) above which we consider the client "falling
 * behind". Small queues drain in a tick or two and should not nag; this only
 * fires once a real backlog builds up.
 */
export const OUT_OF_SYNC_QUEUE_THRESHOLD = 25;

/** Toast id for the collection-agnostic backlog signal. */
export const GLOBAL_TOAST_ID = "sync-health-global";

export const collectionToastId = (collection: string): string =>
  `sync-health-collection:${collection}`;

export type HealthSignalAction = "resolveConflicts" | "retryFailed";

export interface HealthSignal {
  /** Stable toast id: one per collection, plus one for the global backlog. */
  id: string;
  /**
   * Identity of the situation being reported. While this is unchanged the toast
   * is left alone, so it neither flickers nor re-nags after a manual dismiss.
   */
  key: string;
  message: string;
  variant: "warning" | "info";
  subtitle?: string;
  /** When set, the toast shows an action button for {@link action}. */
  buttonText?: string;
  /** Collection the action button targets. */
  collection?: string;
  /**
   * What the toast action button does. Conflicts take priority over failed
   * retries when both are present — resolving conflicts is what unblocks the
   * queue; failed entities can be retried after.
   */
  action?: HealthSignalAction;
}

const plural = (count: number): string => (count === 1 ? "" : "s");

const capitalize = (value: string): string => `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;

/**
 * Per-collection toast for conflicts and failed changes — the things that need a
 * human. Returns null when the collection is healthy.
 */
const computeCollectionSignal = ({
  collection,
  conflictCount,
  failedCount,
  label,
  canOpenConflicts,
  resolveButtonText,
  conflictsSubtitle,
  retryButtonText,
  retrySubtitle,
}: {
  collection: string;
  conflictCount: number;
  failedCount: number;
  label: string;
  canOpenConflicts: boolean;
  resolveButtonText: string;
  conflictsSubtitle: string;
  retryButtonText: string;
  retrySubtitle: string;
}): HealthSignal | null => {
  if (conflictCount === 0 && failedCount === 0) {
    return null;
  }

  const parts: string[] = [];
  if (conflictCount > 0) {
    parts.push(`${conflictCount} conflict${plural(conflictCount)}`);
  }
  if (failedCount > 0) {
    parts.push(`${failedCount} failed change${plural(failedCount)}`);
  }

  const hasConflictsAction = conflictCount > 0 && canOpenConflicts;
  const hasRetryAction = !hasConflictsAction && failedCount > 0;
  let subtitle: string;
  let action: HealthSignalAction | undefined;
  let buttonText: string | undefined;
  if (hasConflictsAction) {
    subtitle = conflictsSubtitle;
    action = "resolveConflicts";
    buttonText = resolveButtonText;
  } else if (hasRetryAction) {
    subtitle = retrySubtitle;
    action = "retryFailed";
    buttonText = retryButtonText;
  } else if (conflictCount > 0) {
    subtitle = `Open ${label} and resolve conflicts to keep syncing.`;
  } else {
    subtitle = `Some changes could not be saved — open ${label} and try again.`;
  }

  return {
    ...(action && buttonText ? {action, buttonText, collection} : {}),
    id: collectionToastId(collection),
    key: `${conflictCount}|${failedCount}|${action ?? "none"}`,
    message: `${label} sync needs attention: ${parts.join(" · ")}`,
    subtitle,
    variant: "warning",
  };
};

/**
 * The one collection-agnostic toast: the queue as a whole is drifting out of
 * sync. A backlog spans every collection, so this stays a single global signal
 * shown alongside any per-collection toasts.
 */
const computeGlobalSignal = ({status}: {status: SyncStatus}): HealthSignal | null => {
  const {isOnline, queuedCount} = status;

  if (!isOnline && queuedCount > 0) {
    return {
      id: GLOBAL_TOAST_ID,
      key: `offline|${queuedCount}`,
      message: `Offline — ${queuedCount} change${plural(queuedCount)} waiting to sync`,
      subtitle: "They'll sync automatically when you reconnect.",
      variant: "info",
    };
  }

  if (isOnline && queuedCount >= OUT_OF_SYNC_QUEUE_THRESHOLD) {
    return {
      id: GLOBAL_TOAST_ID,
      key: `behind|${queuedCount}`,
      message: `Sync is falling behind — ${queuedCount} change${plural(queuedCount)} queued`,
      subtitle: "Still catching up…",
      variant: "warning",
    };
  }

  return null;
};

/**
 * The toasts that should be on screen for `status`, ordered by urgency:
 * collections needing a human first (alphabetically, so the stack does not
 * shuffle between renders), then the informational backlog.
 */
export const computeHealthSignals = ({
  status,
  canOpenConflicts,
  resolveButtonText,
  conflictsSubtitle,
  retryButtonText,
  retrySubtitle,
  collectionLabels,
}: {
  status: SyncStatus;
  canOpenConflicts: boolean;
  resolveButtonText: string;
  conflictsSubtitle: string;
  retryButtonText: string;
  retrySubtitle: string;
  collectionLabels: Record<string, string>;
}): HealthSignal[] => {
  const signals: HealthSignal[] = [];

  for (const [collection, counts] of Object.entries(status.collections ?? {})) {
    const signal = computeCollectionSignal({
      canOpenConflicts,
      collection,
      conflictCount: counts.conflictCount,
      conflictsSubtitle,
      failedCount: counts.failedCount,
      label: collectionLabels[collection] ?? capitalize(collection),
      resolveButtonText,
      retryButtonText,
      retrySubtitle,
    });
    if (signal) {
      signals.push(signal);
    }
  }
  signals.sort((a, b) => a.id.localeCompare(b.id));

  const globalSignal = computeGlobalSignal({status});
  if (globalSignal) {
    signals.push(globalSignal);
  }
  return signals;
};
