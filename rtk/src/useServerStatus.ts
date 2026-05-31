import {DateTime} from "luxon";
import {useCallback, useEffect, useRef} from "react";
import {useDispatch} from "react-redux";

import {baseUrl} from "./constants";
import {setConnectionQuality, setHealthCheckSnapshot} from "./offlineSlice";
import type {ConnectionQuality, ConnectionQualityConfig} from "./offlineTypes";
import {
  type OfflineStatus,
  type UseOfflineStatusOptions,
  useOfflineStatus,
} from "./useOfflineStatus";

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const OFFLINE_POLL_INTERVAL_MS = 3_000;
const DEFAULT_TIMEOUT_MS = 4_000;
const DEFAULT_SPOTTY_LATENCY_MS = 1_500;
const DEFAULT_OFFLINE_FAILURE_COUNT = 3;
const DEFAULT_SPOTTY_FAILURE_RATE = 0.4;
const HEALTH_HISTORY_SIZE = 10;

export interface ServerStatusOptions extends UseOfflineStatusOptions {
  healthUrl?: string;
  pollIntervalMs?: number;
  offlinePollIntervalMs?: number;
  timeoutMs?: number;
  spottyLatencyMs?: number;
  offlineFailureCount?: number;
  spottyFailureRate?: number;
  skip?: boolean;
}

export type ServerStatus = OfflineStatus;

const computeConnectionQuality = ({
  consecutiveFailures,
  recentFailureRate,
  latencyMs,
  spottyLatencyMs,
  offlineFailureCount,
  spottyFailureRate,
}: {
  consecutiveFailures: number;
  recentFailureRate: number;
  latencyMs?: number;
  spottyLatencyMs: number;
  offlineFailureCount: number;
  spottyFailureRate: number;
}): ConnectionQuality => {
  if (consecutiveFailures >= offlineFailureCount) {
    return "offline";
  }
  if (recentFailureRate >= spottyFailureRate) {
    return "spotty";
  }
  if (latencyMs !== undefined && latencyMs >= spottyLatencyMs) {
    return "spotty";
  }
  return "online";
};

export const useServerStatus = (options: ServerStatusOptions = {}): ServerStatus => {
  const {
    healthUrl = `${baseUrl}/health`,
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    offlinePollIntervalMs = OFFLINE_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    spottyLatencyMs = DEFAULT_SPOTTY_LATENCY_MS,
    offlineFailureCount = DEFAULT_OFFLINE_FAILURE_COUNT,
    spottyFailureRate = DEFAULT_SPOTTY_FAILURE_RATE,
    skip = false,
    api,
  } = options;

  const offlineStatus = useOfflineStatus({api});
  const dispatch = useDispatch();

  const qualityRef = useRef(offlineStatus.connectionQuality);
  qualityRef.current = offlineStatus.connectionQuality;

  const healthHistoryRef = useRef<boolean[]>([]);
  const consecutiveFailuresRef = useRef(0);

  const recordHealthResult = useCallback(
    (success: boolean, latencyMs?: number): void => {
      const history = healthHistoryRef.current;
      history.push(success);
      if (history.length > HEALTH_HISTORY_SIZE) {
        history.shift();
      }

      if (success) {
        consecutiveFailuresRef.current = 0;
      } else {
        consecutiveFailuresRef.current += 1;
      }

      const recentFailureRate =
        history.length === 0 ? 0 : history.filter((entry) => !entry).length / history.length;

      const quality = computeConnectionQuality({
        consecutiveFailures: consecutiveFailuresRef.current,
        latencyMs,
        offlineFailureCount,
        recentFailureRate,
        spottyFailureRate,
        spottyLatencyMs,
      });

      dispatch(
        setHealthCheckSnapshot({
          checkedAt: DateTime.now().toISO(),
          consecutiveFailures: consecutiveFailuresRef.current,
          latencyMs,
          recentFailureRate,
        })
      );

      if (quality !== qualityRef.current) {
        dispatch(setConnectionQuality(quality));
      }
    },
    [dispatch, offlineFailureCount, spottyFailureRate, spottyLatencyMs]
  );

  const checkHealth = useCallback(async (): Promise<void> => {
    const startedAt = DateTime.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(healthUrl, {
        cache: "no-store",
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = DateTime.now().diff(startedAt).milliseconds;
      recordHealthResult(response.ok, latencyMs);
    } catch {
      recordHealthResult(false);
    }
  }, [healthUrl, timeoutMs, recordHealthResult]);

  useEffect(() => {
    if (skip || typeof window === "undefined") {
      return;
    }

    void checkHealth();

    const interval =
      offlineStatus.connectionQuality === "offline" ? offlinePollIntervalMs : pollIntervalMs;
    const id = setInterval(() => {
      void checkHealth();
    }, interval);

    return (): void => {
      clearInterval(id);
    };
  }, [skip, checkHealth, offlineStatus.connectionQuality, pollIntervalMs, offlinePollIntervalMs]);

  useEffect(() => {
    if (skip || typeof window === "undefined" || typeof window.addEventListener !== "function") {
      return;
    }

    const handleOffline = (): void => {
      dispatch(setConnectionQuality("offline"));
    };

    const handleOnline = (): void => {
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

export const connectionQualityFromConfig = (
  config?: ConnectionQualityConfig
): ConnectionQualityConfig => {
  return {
    healthUrl: config?.healthUrl,
    offlineFailureCount: config?.offlineFailureCount ?? DEFAULT_OFFLINE_FAILURE_COUNT,
    offlinePollIntervalMs: config?.offlinePollIntervalMs ?? OFFLINE_POLL_INTERVAL_MS,
    pollIntervalMs: config?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    spottyFailureRate: config?.spottyFailureRate ?? DEFAULT_SPOTTY_FAILURE_RATE,
    spottyLatencyMs: config?.spottyLatencyMs ?? DEFAULT_SPOTTY_LATENCY_MS,
    timeoutMs: config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
};
