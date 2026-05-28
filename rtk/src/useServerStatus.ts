import {useCallback, useEffect, useRef} from "react";
import {useDispatch} from "react-redux";

import {baseUrl} from "./constants";
import {setOnlineStatus} from "./offlineSlice";
import {type OfflineStatus, useOfflineStatus} from "./useOfflineStatus";

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

export type ServerStatus = OfflineStatus;

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

  const offlineStatus = useOfflineStatus();
  const dispatch = useDispatch();

  const isOnlineRef = useRef(offlineStatus.isOnline);
  isOnlineRef.current = offlineStatus.isOnline;

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

    const interval = offlineStatus.isOnline ? pollIntervalMs : offlinePollIntervalMs;
    const id = setInterval(() => {
      void checkHealth();
    }, interval);

    return (): void => {
      clearInterval(id);
    };
  }, [skip, checkHealth, offlineStatus.isOnline, pollIntervalMs, offlinePollIntervalMs]);

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

  return offlineStatus;
};
