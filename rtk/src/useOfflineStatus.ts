import {useCallback} from "react";
import {useDispatch, useSelector} from "react-redux";

import {
  type ConflictRecord,
  clearConflicts,
  dismissConflict,
  type OfflineState,
  selectConflicts,
  selectIsOnline,
  selectIsSyncing,
  selectQueueLength,
  selectUndismissedConflicts,
} from "./offlineSlice";

export interface OfflineStatus {
  /** Whether the device currently has network connectivity */
  isOnline: boolean;
  /** Number of mutations waiting to be synced */
  queueLength: number;
  /** Whether mutations are currently being replayed to the server */
  isSyncing: boolean;
  /** All conflict records (including dismissed) */
  conflicts: ConflictRecord[];
  /** Conflict records the user hasn't dismissed yet */
  undismissedConflicts: ConflictRecord[];
  /** Dismiss a single conflict notification by ID */
  dismissConflict: (id: string) => void;
  /** Clear all conflict records */
  clearConflicts: () => void;
  /** Returns true if the item exists only locally (not yet synced to server) */
  isLocalOnly: (id: string) => boolean;
}

/**
 * Hook for consuming offline state, sync status, and conflict notifications.
 *
 * Usage:
 * ```typescript
 * const {isOnline, queueLength, isSyncing, undismissedConflicts, dismissConflict} = useOfflineStatus();
 *
 * if (!isOnline) {
 *   return <Banner text={`Offline. ${queueLength} changes pending.`} />;
 * }
 * ```
 */
export const useOfflineStatus = (): OfflineStatus => {
  const dispatch = useDispatch();
  const isOnline = useSelector((state: {offline: OfflineState}) => selectIsOnline(state));
  const queueLength = useSelector((state: {offline: OfflineState}) => selectQueueLength(state));
  const isSyncing = useSelector((state: {offline: OfflineState}) => selectIsSyncing(state));
  const conflicts = useSelector((state: {offline: OfflineState}) => selectConflicts(state));
  const undismissedConflicts = useSelector((state: {offline: OfflineState}) =>
    selectUndismissedConflicts(state)
  );

  const handleDismissConflict = useCallback(
    (id: string) => {
      dispatch(dismissConflict(id));
    },
    [dispatch]
  );

  const handleClearConflicts = useCallback(() => {
    dispatch(clearConflicts());
  }, [dispatch]);

  const isLocalOnly = useCallback((id: string): boolean => {
    return typeof id === "string" && id.startsWith("temp-");
  }, []);

  return {
    clearConflicts: handleClearConflicts,
    conflicts,
    dismissConflict: handleDismissConflict,
    isLocalOnly,
    isOnline,
    isSyncing,
    queueLength,
    undismissedConflicts,
  };
};
