import {useEffect, useState} from "react";
import {useSelector} from "react-redux";

import {isWebsocketsDebugEnabled, setRealtimeDebug} from "./constants";
import {type OfflineState, selectIsOnline} from "./offlineSlice";

interface RealtimeHealthResponse {
  debug?: boolean;
}

/**
 * Syncs websocket debug logging with the backend RealtimeApp debug flag.
 * Also respects WEBSOCKETS_DEBUG from app config via isWebsocketsDebugEnabled().
 */
export const useRealtimeDebug = (baseUrl: string, refreshKey?: unknown): boolean => {
  const [debugEnabled, setDebugEnabled] = useState(isWebsocketsDebugEnabled);
  const isOnline = useSelector((state: {offline: OfflineState}) => selectIsOnline(state));

  useEffect(() => {
    if (!isOnline) {
      return;
    }

    let cancelled = false;

    const loadDebugFlag = async (): Promise<void> => {
      try {
        const response = await fetch(`${baseUrl}/realtime/health`);
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as RealtimeHealthResponse;
        if (cancelled) {
          return;
        }
        setRealtimeDebug(data.debug === true);
        setDebugEnabled(isWebsocketsDebugEnabled());
      } catch {
        // Health endpoint unavailable — keep env-based debug only
      }
    };

    void loadDebugFlag();

    return (): void => {
      cancelled = true;
    };
  }, [baseUrl, refreshKey, isOnline]);

  return debugEnabled;
};
