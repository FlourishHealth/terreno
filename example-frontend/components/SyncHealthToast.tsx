/**
 * App-wide sync health watcher. Shows PERSISTENT toasts whenever the local-first
 * data layer needs attention: one toast per collection with unresolved conflicts
 * or changes that failed to sync (each naming the collection it affects), plus a
 * single global toast for a backlog that is drifting out of sync. Toasts update
 * in place as the situation changes and disappear once everything is healthy
 * again. See ./syncHealthSignals for which toasts a given status produces.
 *
 * On initial launch only, also shows an info "Syncing…" toast with a Force reload
 * button while the first bootstrap is in flight. Later background syncs do not
 * re-show it.
 *
 * When conflicts are present and the consuming app provides
 * `renderConflictsModal`, the collection's toast includes a Resolve button that
 * opens that modal scoped to that collection's conflicts. The modal UI itself is
 * fully owned by the app (e.g. ConflictSheet or a custom screen).
 *
 * When a collection only has failed changes, the toast includes a Retry button
 * that calls `client.retryFailed` for each failed entity in that collection so
 * blocked successors can drain again. If retry can't run (offline / auth pause /
 * nothing to retry) or `replayOutbox` throws, an error toast is shown.
 *
 * Mount once inside both TerrenoProvider (for toasts) and a SyncDbProvider (for
 * status) — see app/_layout.tsx.
 */
import type {ConflictResolutionStrategy, SyncConflict} from "@terreno/syncdb";
import {OUTBOX_TABLE} from "@terreno/syncdb";
import {useConflicts, useSyncDbClient, useSyncStatus} from "@terreno/syncdb/react";
import {useToast} from "@terreno/ui";
import type React from "react";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useSyncDbReady} from "@/hooks/useSyncDbReady";

import {
  failedEntityIdsForCollection,
  getRetryBlockedReason,
  nothingToRetryMessage,
  RETRY_ERROR_TOAST_ID,
  retryBlockedMessage,
  retryFailedMessage,
} from "./syncHealthRetry";
import {computeHealthSignals} from "./syncHealthSignals";

const DEFAULT_RESOLVE_BUTTON_TEXT = "Resolve";
const DEFAULT_CONFLICTS_SUBTITLE = "Tap Resolve to review and fix conflicts.";
const DEFAULT_RETRY_BUTTON_TEXT = "Retry";
const DEFAULT_RETRY_SUBTITLE = "Tap Retry to try syncing those changes again.";
const EMPTY_LABELS: Record<string, string> = {};

/** One-shot toast while the first bootstrap sync after launch is in flight. */
const INITIAL_SYNC_TOAST_ID = "sync-initial-syncing";
const INITIAL_SYNC_TOAST_TITLE = "Syncing…";
const INITIAL_SYNC_TOAST_SUBTITLE = "Loading your latest data.";
const INITIAL_SYNC_FORCE_RELOAD_TEXT = "Force reload";

const RESYNC_SKIP_MESSAGES: Record<string, string> = {
  authPaused: "Sync is paused — sign in again, then retry.",
  noHttpChannel: "Cannot reload: sync is not configured.",
  noStreams: "No sync streams found for this account.",
  offline: "Cannot reload while offline.",
};

const collectionLabel = ({
  collection,
  collectionLabels,
}: {
  collection: string;
  collectionLabels: Record<string, string>;
}): string =>
  collectionLabels[collection] ?? `${collection.slice(0, 1).toUpperCase()}${collection.slice(1)}`;

export interface SyncHealthConflictsModalArgs {
  visible: boolean;
  onDismiss: () => void;
  /** Conflicts to show — already narrowed to `collection` when one is set. */
  conflicts: SyncConflict[];
  /** Collection the modal was opened for, or undefined for every collection. */
  collection?: string;
  resolve: (args: {mutationId: string; strategy: ConflictResolutionStrategy}) => void;
}

export interface SyncHealthToastProps {
  /**
   * Renders the conflicts UI opened from a toast's Resolve button. When omitted,
   * toasts still warn about conflicts but show no Resolve action — the app can
   * surface resolution elsewhere (e.g. SyncStatusBanner).
   */
  renderConflictsModal?: (args: SyncHealthConflictsModalArgs) => React.ReactNode;
  /** Label for the toast action button when conflicts are present. */
  resolveButtonText?: string;
  /** Subtitle shown on a conflicts toast. */
  conflictsSubtitle?: string;
  /** Label for the toast action button when only failed changes are present. */
  retryButtonText?: string;
  /** Subtitle shown on a failed-changes toast. */
  retrySubtitle?: string;
  /**
   * Human-readable names for collections, keyed by collection name. Collections
   * without an entry fall back to their capitalized name (`todos` → `Todos`).
   */
  collectionLabels?: Record<string, string>;
}

export const SyncHealthToast: React.FC<SyncHealthToastProps> = ({
  renderConflictsModal,
  resolveButtonText = DEFAULT_RESOLVE_BUTTON_TEXT,
  conflictsSubtitle = DEFAULT_CONFLICTS_SUBTITLE,
  retryButtonText = DEFAULT_RETRY_BUTTON_TEXT,
  retrySubtitle = DEFAULT_RETRY_SUBTITLE,
  collectionLabels = EMPTY_LABELS,
}) => {
  const client = useSyncDbClient();
  const status = useSyncStatus();
  const isSyncDbReady = useSyncDbReady();
  const toast = useToast();
  const {conflicts, resolve} = useConflicts();
  // Collection the modal is scoped to; null means closed.
  const [modalCollection, setModalCollection] = useState<string | null>(null);
  const canOpenConflicts = Boolean(renderConflictsModal);

  // Toast id → the signal key currently shown for it. Drives show/hide and lets
  // a manual dismiss stick until the situation materially changes.
  const shownKeysRef = useRef<Map<string, string>>(new Map());
  // `useToast()` returns a fresh object on every render. Keep the latest in a
  // ref so the effects below don't depend on its identity — otherwise they'd
  // re-run every render and the cleanup would hide the toasts immediately,
  // making them non-persistent.
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // One-shot gate for the launch "Syncing…" toast: show on the first isSyncing
  // episode after mount, then never again for later background syncs.
  const initialSyncPhaseRef = useRef<"pending" | "showing" | "done">("pending");
  const forceReloadInFlightRef = useRef(false);

  const handleForceReload = useCallback(async (): Promise<void> => {
    if (forceReloadInFlightRef.current) {
      return;
    }
    forceReloadInFlightRef.current = true;
    const toastApi = toastRef.current;
    try {
      const result = await client.forceResync();
      if (!result.ok) {
        toastApi.error(
          RESYNC_SKIP_MESSAGES[result.reason ?? "noStreams"] ?? "Force reload did not run.",
          {id: INITIAL_SYNC_TOAST_ID}
        );
        return;
      }
      toastApi.success(`Reloaded ${result.streams} stream${result.streams === 1 ? "" : "s"}.`, {
        id: INITIAL_SYNC_TOAST_ID,
      });
    } catch (error: unknown) {
      toastApi.catch(error, "Force reload failed", {id: INITIAL_SYNC_TOAST_ID});
    } finally {
      forceReloadInFlightRef.current = false;
      initialSyncPhaseRef.current = "done";
    }
  }, [client]);

  const handleForceReloadRef = useRef(handleForceReload);
  handleForceReloadRef.current = handleForceReload;

  // Show an info toast only for the first syncing episode after launch.
  useEffect(() => {
    const toastApi = toastRef.current;
    const phase = initialSyncPhaseRef.current;

    if (phase === "done") {
      return;
    }

    if (status.isSyncing && phase === "pending") {
      initialSyncPhaseRef.current = "showing";
      toastApi.info(INITIAL_SYNC_TOAST_TITLE, {
        buttonOnClick: (): void => {
          void handleForceReloadRef.current();
        },
        buttonText: INITIAL_SYNC_FORCE_RELOAD_TEXT,
        id: INITIAL_SYNC_TOAST_ID,
        persistent: true,
        size: "lg",
        subtitle: INITIAL_SYNC_TOAST_SUBTITLE,
      });
      return;
    }

    if (!status.isSyncing && phase === "showing") {
      initialSyncPhaseRef.current = "done";
      toastApi.hide(INITIAL_SYNC_TOAST_ID);
      return;
    }

    // start() finished without a visible syncing window (or it finished before
    // this effect ran) — do not treat later background syncs as "initial launch".
    if (!status.isSyncing && phase === "pending" && isSyncDbReady) {
      initialSyncPhaseRef.current = "done";
    }
  }, [status.isSyncing, isSyncDbReady]);

  const openConflictsModal = useCallback(
    (collection: string): void => {
      if (!canOpenConflicts) {
        return;
      }
      setModalCollection(collection);
    },
    [canOpenConflicts]
  );

  const retryFailedForCollection = useCallback(
    async (collection: string): Promise<void> => {
      const toastApi = toastRef.current;
      const label = collectionLabel({collection, collectionLabels});

      try {
        const before = client.getSyncStatus();
        const blockedBefore = getRetryBlockedReason(before);
        if (blockedBefore) {
          toastApi.error(retryBlockedMessage({label, phase: "before", reason: blockedBefore}), {
            id: RETRY_ERROR_TOAST_ID,
          });
          return;
        }

        const entityIds = failedEntityIdsForCollection({
          collection,
          outboxRows: client.store.raw.getTable(OUTBOX_TABLE),
        });
        if (entityIds.length === 0) {
          toastApi.error(nothingToRetryMessage(label), {id: RETRY_ERROR_TOAST_ID});
          return;
        }

        // Clear validation blocks first; each call also kicks a fire-and-forget
        // replay (coalesced in the coordinator). Await an explicit drain so we
        // can surface failures instead of swallowing them.
        for (const entityId of entityIds) {
          client.retryFailed({entityId});
        }
        await client.replayOutbox();

        const after = client.getSyncStatus();
        const blockedAfter = getRetryBlockedReason(after);
        if (blockedAfter) {
          toastApi.error(retryBlockedMessage({label, phase: "after", reason: blockedAfter}), {
            id: RETRY_ERROR_TOAST_ID,
          });
        }
      } catch (error: unknown) {
        toastApi.catch(error, retryFailedMessage(label), {id: RETRY_ERROR_TOAST_ID});
      }
    },
    [client, collectionLabels]
  );

  // Keep stable refs for toast action buttons so the callback captured when a
  // toast is shown always reaches the latest handlers.
  const openConflictsModalRef = useRef(openConflictsModal);
  openConflictsModalRef.current = openConflictsModal;
  const retryFailedForCollectionRef = useRef(retryFailedForCollection);
  retryFailedForCollectionRef.current = retryFailedForCollection;

  const closeConflictsModal = useCallback((): void => {
    setModalCollection(null);
  }, []);

  const signals = computeHealthSignals({
    canOpenConflicts,
    collectionLabels,
    conflictsSubtitle,
    resolveButtonText,
    retryButtonText,
    retrySubtitle,
    status,
  });
  // Primitive stand-in for `signals` (a fresh array every render) so the effect
  // below runs only when the set of toasts that should be on screen changes.
  const signalsKey = signals.map((signal) => `${signal.id}=${signal.key}`).join("|");

  // Reconcile the toasts on screen with the current signals.
  useEffect(() => {
    const toastApi = toastRef.current;
    const shownKeys = shownKeysRef.current;
    const currentIds = new Set(signals.map((signal) => signal.id));

    // Retract toasts whose collection recovered (or whose backlog drained).
    for (const id of [...shownKeys.keys()]) {
      if (!currentIds.has(id)) {
        toastApi.hide(id);
        shownKeys.delete(id);
      }
    }

    for (const signal of signals) {
      if (shownKeys.get(signal.id) === signal.key) {
        continue;
      }
      shownKeys.set(signal.id, signal.key);
      const show = signal.variant === "warning" ? toastApi.warn : toastApi.info;
      const {action, collection} = signal;
      let buttonOnClick: (() => void) | undefined;
      if (collection !== undefined && action === "resolveConflicts") {
        buttonOnClick = (): void => {
          openConflictsModalRef.current(collection);
        };
      } else if (collection !== undefined && action === "retryFailed") {
        buttonOnClick = (): void => {
          void retryFailedForCollectionRef.current(collection);
        };
      }
      show(signal.message, {
        buttonOnClick,
        buttonText: signal.buttonText,
        id: signal.id,
        persistent: true,
        size: "lg",
        subtitle: signal.subtitle,
      });
    }
  }, [signalsKey]);

  // Hide every toast only when this watcher unmounts (e.g. logout) — empty deps
  // so it never fires on a routine re-render.
  useEffect(() => {
    return (): void => {
      const toastApi = toastRef.current;
      for (const id of shownKeysRef.current.keys()) {
        toastApi.hide(id);
      }
      shownKeysRef.current.clear();
      toastApi.hide(INITIAL_SYNC_TOAST_ID);
      initialSyncPhaseRef.current = "pending";
    };
  }, []);

  const visibleConflicts = useMemo((): SyncConflict[] => {
    if (modalCollection === null) {
      return conflicts;
    }
    return conflicts.filter((conflict) => conflict.collection === modalCollection);
  }, [conflicts, modalCollection]);

  // Close the conflicts modal once every conflict it covers is resolved (e.g.
  // from another surface) so it does not linger empty over the app.
  useEffect(() => {
    if (modalCollection !== null && visibleConflicts.length === 0) {
      setModalCollection(null);
    }
  }, [modalCollection, visibleConflicts.length]);

  if (!renderConflictsModal) {
    return null;
  }

  return renderConflictsModal({
    ...(modalCollection === null ? {} : {collection: modalCollection}),
    conflicts: visibleConflicts,
    onDismiss: closeConflictsModal,
    resolve,
    visible: modalCollection !== null,
  });
};
