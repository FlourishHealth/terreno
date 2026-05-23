import {useCallback, useEffect, useRef} from "react";
import {useDispatch, useSelector} from "react-redux";

import {baseUrl} from "./constants";
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
  setOnlineStatus,
} from "./offlineSlice";

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const OFFLINE_POLL_INTERVAL_MS = 3_000;

export interface ServerStatusOptions {
  /** URL to poll for server health. Defaults to `${baseUrl}/health`. */
  healthUrl?: string;
  /** Polling interval in ms while online. Default 5000. */
  pollIntervalMs?: number;
  /** Polling interval in ms while offline. Default 3000. */
  offlinePollIntervalMs?: number;
  /** Skip polling entirely (e.g. when not authenticated). */
  skip?: boolean;
}

export interface ServerStatus {
  /** Whether the API server is currently reachable */
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
 * Polls the API server health endpoint to determine actual server reachability.
 * Dispatches setOnlineStatus(true/false) into the offline slice so the rest
 * of the offline middleware (queue, optimistic updates, replay) reacts.
 *
 * Use this instead of useOfflineStatus when you want real server-connectivity
 * detection rather than just browser navigator.onLine.
 *
 * @example
 * ```typescript
 * const {isOnline, queueLength, isSyncing, isLocalOnly} = useServerStatus({
 *   skip: !userId,
 * });
 * ```
 */
export const useServerStatus = (options: ServerStatusOptions = {}): ServerStatus => {
  const {
    healthUrl = `${baseUrl}/health`,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    offlinePollIntervalMs = OFFLINE_POLL_INTERVAL_MS,
    skip = false,
  } = options;

  const dispatch = useDispatch();
  const isOnline = useSelector((state: {offline: OfflineState}) => selectIsOnline(state));
  const queueLength = useSelector((state: {offline: OfflineState}) => selectQueueLength(state));
  const isSyncing = useSelector((state: {offline: OfflineState}) => selectIsSyncing(state));
  const conflicts = useSelector((state: {offline: OfflineState}) => selectConflicts(state));
  const undismissedConflicts = useSelector((state: {offline: OfflineState}) =>
    selectUndismissedConflicts(state)
  );

  const isOnlineRef = useRef(isOnline);
  isOnlineRef.current = isOnline;

  // Ping the server health endpoint; dispatch status changes
  const checkHealth = useCallback(async (): Promise<void> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4_000);

      const response = await fetch(healthUrl, {
        cache: "no-store",
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok && !isOnlineRef.current) {
        dispatch(setOnlineStatus(true));
      } else if (!response.ok && isOnlineRef.current) {
        dispatch(setOnlineStatus(false));
      }
    } catch {
      if (isOnlineRef.current) {
        dispatch(setOnlineStatus(false));
      }
    }
  }, [healthUrl, dispatch]);

  // Poll at different intervals depending on online/offline state
  useEffect(() => {
    if (skip || typeof window === "undefined") {
      return;
    }

    // Check immediately on mount
    void checkHealth();

    const interval = isOnline ? pollIntervalMs : offlinePollIntervalMs;
    const id = setInterval(() => {
      void checkHealth();
    }, interval);

    return (): void => {
      clearInterval(id);
    };
  }, [skip, checkHealth, isOnline, pollIntervalMs, offlinePollIntervalMs]);

  // Also respond to browser online/offline events for instant detection
  useEffect(() => {
    if (skip || typeof window === "undefined") {
      return;
    }

    const handleOffline = (): void => {
      dispatch(setOnlineStatus(false));
    };

    const handleOnline = (): void => {
      // Don't trust the browser event alone — verify with health check
      void checkHealth();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return (): void => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [skip, dispatch, checkHealth]);

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
