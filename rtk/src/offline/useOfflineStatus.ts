import type {Api} from "@reduxjs/toolkit/query/react";
import {useCallback} from "react";
import {useDispatch, useSelector, useStore} from "react-redux";

import {resolveConflict as resolveConflictAction} from "./offlineMiddleware";
import {
  type ConflictRecord,
  type ConflictResolution,
  clearConflicts,
  dismissConflict,
  type OfflineState,
  selectAuthBlockedQueueLength,
  selectConflicts,
  selectConnectionQuality,
  selectIsOnline,
  selectIsReplayPausedForAuth,
  selectIsSyncing,
  selectLastHealthCheck,
  selectOfflineQueue,
  selectQueueLength,
  selectUndismissedConflicts,
} from "./offlineSlice";
import type {ConnectionQuality} from "./offlineTypes";

export interface OfflineStatus {
  connectionQuality: ConnectionQuality;
  /** Whether the server/device is considered reachable (connectionQuality !== offline) */
  isOnline: boolean;
  queueLength: number;
  isSyncing: boolean;
  isReplayPausedForAuth: boolean;
  authBlockedCount: number;
  conflicts: ConflictRecord[];
  undismissedConflicts: ConflictRecord[];
  lastHealthCheck: ReturnType<typeof selectLastHealthCheck>;
  dismissConflict: (id: string) => void;
  clearConflicts: () => void;
  resolveConflict: (params: {conflictId: string; resolution: ConflictResolution}) => void;
  isLocalOnly: (id: string) => boolean;
}

export interface UseOfflineStatusOptions {
  // biome-ignore lint/suspicious/noExplicitAny: Generic API type
  api?: Api<any, any, any, any>;
}

export const useOfflineStatus = (options: UseOfflineStatusOptions = {}): OfflineStatus => {
  const dispatch = useDispatch();
  const store = useStore();
  const {api} = options;

  const connectionQuality = useSelector((state: {offline: OfflineState}) =>
    selectConnectionQuality(state)
  );
  const isOnline = useSelector((state: {offline: OfflineState}) => selectIsOnline(state));
  const queueLength = useSelector((state: {offline: OfflineState}) => selectQueueLength(state));
  const queue = useSelector((state: {offline: OfflineState}) => selectOfflineQueue(state));
  const isSyncing = useSelector((state: {offline: OfflineState}) => selectIsSyncing(state));
  const isReplayPausedForAuth = useSelector((state: {offline: OfflineState}) =>
    selectIsReplayPausedForAuth(state)
  );
  const authBlockedCount = useSelector((state: {offline: OfflineState}) =>
    selectAuthBlockedQueueLength(state)
  );
  const conflicts = useSelector((state: {offline: OfflineState}) => selectConflicts(state));
  const undismissedConflicts = useSelector((state: {offline: OfflineState}) =>
    selectUndismissedConflicts(state)
  );
  const lastHealthCheck = useSelector((state: {offline: OfflineState}) =>
    selectLastHealthCheck(state)
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

  const handleResolveConflict = useCallback(
    (params: {conflictId: string; resolution: ConflictResolution}) => {
      if (!api) {
        console.warn("[offline] resolveConflict requires api in useOfflineStatus options");
        return;
      }

      resolveConflictAction({
        api,
        conflictId: params.conflictId,
        conflicts,
        // biome-ignore lint/suspicious/noExplicitAny: dispatch accepts offline actions
        dispatch: dispatch as any,
        getState: () => store.getState(),
        resolution: params.resolution,
      });
    },
    [api, conflicts, dispatch, store]
  );

  const isLocalOnly = useCallback(
    (id: string): boolean => {
      if (typeof id !== "string") {
        return false;
      }
      if (id.startsWith("temp-")) {
        return true;
      }
      return queue.some(
        (mutation) =>
          mutation.optimisticId === id &&
          (mutation.status === "queued" ||
            mutation.status === "authBlocked" ||
            mutation.status === "replaying")
      );
    },
    [queue]
  );

  return {
    authBlockedCount,
    clearConflicts: handleClearConflicts,
    conflicts,
    connectionQuality,
    dismissConflict: handleDismissConflict,
    isLocalOnly,
    isOnline,
    isReplayPausedForAuth,
    isSyncing,
    lastHealthCheck,
    queueLength,
    resolveConflict: handleResolveConflict,
    undismissedConflicts,
  };
};
