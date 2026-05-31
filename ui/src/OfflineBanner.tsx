import type React from "react";

import {Banner} from "./Banner";
import {Box} from "./Box";

export type OfflineConnectionQuality = "online" | "spotty" | "offline";

export interface OfflineBannerProps {
  /** Whether the server is currently reachable */
  isOnline: boolean;
  /** Connection quality from useServerStatus / useOfflineStatus */
  connectionQuality?: OfflineConnectionQuality;
  /** Number of mutations waiting to be synced */
  queueLength: number;
  /** Whether mutations are currently being replayed */
  isSyncing: boolean;
  /** Whether replay is paused waiting for auth refresh */
  isReplayPausedForAuth?: boolean;
  /** testID for the root element */
  testID?: string;
}

const pendingSuffix = (queueLength: number): string => {
  if (queueLength <= 0) {
    return "";
  }
  const noun = queueLength === 1 ? "change" : "changes";
  return ` ${queueLength} pending ${noun} will sync when you reconnect.`;
};

/**
 * Displays offline/spotty/syncing/auth-blocked status banners. Renders nothing when online and idle.
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  isOnline,
  connectionQuality,
  queueLength,
  isSyncing,
  isReplayPausedForAuth = false,
  testID = "offline-banner",
}) => {
  const quality = connectionQuality ?? (isOnline ? "online" : "offline");

  if (isSyncing) {
    return (
      <Box marginBottom={4} testID={testID}>
        <Box testID="syncing-banner">
          <Banner id="syncing-status" status="info" text="Syncing offline changes..." />
        </Box>
      </Box>
    );
  }

  if (isReplayPausedForAuth) {
    return (
      <Box marginBottom={4} testID={testID}>
        <Banner
          id="auth-blocked-status"
          status="warning"
          text={`Sync paused until you reconnect.${pendingSuffix(queueLength)}`}
        />
      </Box>
    );
  }

  if (quality === "spotty") {
    return (
      <Box marginBottom={4} testID={testID}>
        <Banner
          id="spotty-status"
          status="warning"
          text={`Connection is unstable.${pendingSuffix(queueLength)}`}
        />
      </Box>
    );
  }

  if (quality === "offline" || !isOnline) {
    return (
      <Box marginBottom={4} testID={testID}>
        <Banner
          id="offline-status"
          status="warning"
          text={`You're offline.${pendingSuffix(queueLength)}`}
        />
      </Box>
    );
  }

  if (queueLength > 0) {
    return (
      <Box marginBottom={4} testID={testID}>
        <Banner
          id="pending-status"
          status="info"
          text={`${queueLength} pending ${queueLength === 1 ? "change" : "changes"} waiting to sync.`}
        />
      </Box>
    );
  }

  return null;
};
