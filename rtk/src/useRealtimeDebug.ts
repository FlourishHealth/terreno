import {useEffect, useState} from "react";

import {isWebsocketsDebugEnabled, setRealtimeDebug} from "./constants";

interface RealtimeHealthResponse {
  debug?: boolean;
}

/**
 * Syncs websocket debug logging with the backend RealtimeApp debug flag.
 * Also respects WEBSOCKETS_DEBUG from app config via isWebsocketsDebugEnabled().
 */
export const useRealtimeDebug = (baseUrl: string, refreshKey?: unknown): boolean => {
  const [debugEnabled, setDebugEnabled] = useState(isWebsocketsDebugEnabled);

  useEffect(() => {
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
  }, [baseUrl, refreshKey]);

  return debugEnabled;
};
