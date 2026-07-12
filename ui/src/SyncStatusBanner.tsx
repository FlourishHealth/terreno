import type React from "react";
import {useCallback} from "react";

import {Badge} from "./Badge";
import {Box} from "./Box";
import {Text} from "./Text";

/** Queued count above which the banner switches to a numeric drain-progress display. */
const PROGRESS_THRESHOLD = 20;

export interface SyncStatusBannerProps {
  /** Whether the client currently has connectivity. */
  isOnline: boolean;
  /** Number of mutations waiting in the durable outbox. */
  queuedCount: number;
  /** Whether a sync/replay is currently in flight. */
  isSyncing: boolean;
  /** Number of unresolved conflicts. */
  conflictCount: number;
  /**
   * Set when replay is paused pending re-authentication (B4/INV-2). Tapping
   * the paused indicator invokes `onAuthRequired`.
   */
  paused?: "auth";
  /** Count of mutations in the terminal `failed` state (B5). */
  failedCount?: number;
  /** True while a batched drain is actively in flight (B5). */
  draining?: boolean;
  /** Mutations attempted so far in the current (or most recent) drain (B5). */
  sentThisDrain?: number;
  /** Queue length observed when the current (or most recent) drain began (B5). */
  totalThisDrain?: number;
  /** Opens the conflict resolution UI; wired to the pressable conflict badge. */
  onOpenConflicts?: () => void;
  /** Invoked when the paused-for-auth indicator is tapped, to prompt re-login. */
  onAuthRequired?: () => void;
  /** Opens a failed-mutations detail view; wired to the pressable failed badge. */
  onOpenFailed?: () => void;
  testID?: string;
}

/**
 * Compact, presentational sync-state banner for local-first (e.g. @terreno/syncdb) screens:
 * offline indicator, queued mutation count (with drain progress once the queue grows past
 * {@link PROGRESS_THRESHOLD}), syncing state, a paused-for-auth indicator, a pressable failed
 * count, and a pressable conflict badge. It is intentionally data-driven (no data-layer imports)
 * so it can be reused with any sync store — wire a status hook (such as `useSyncStatus`) to its
 * props in the consuming app.
 */
export const SyncStatusBanner: React.FC<SyncStatusBannerProps> = ({
  isOnline,
  queuedCount,
  isSyncing,
  conflictCount,
  paused,
  failedCount = 0,
  draining = false,
  sentThisDrain = 0,
  totalThisDrain = 0,
  onOpenConflicts,
  onAuthRequired,
  onOpenFailed,
  testID = "sync-status-banner",
}) => {
  const handleOpenConflicts = useCallback((): void => {
    onOpenConflicts?.();
  }, [onOpenConflicts]);

  const handleAuthRequired = useCallback((): void => {
    onAuthRequired?.();
  }, [onAuthRequired]);

  const handleOpenFailed = useCallback((): void => {
    onOpenFailed?.();
  }, [onOpenFailed]);

  const showProgress = draining && queuedCount > PROGRESS_THRESHOLD && totalThisDrain > 0;

  return (
    <Box direction="row" gap={2} marginBottom={4} testID={testID} wrap>
      {!isOnline && (
        <Box alignItems="center" direction="row" gap={1} testID="sync-offline-indicator">
          <Badge status="error" value="Offline" />
        </Box>
      )}
      {paused === "auth" && (
        <Box
          accessibilityHint="Sign in again to resume syncing"
          accessibilityLabel="Sync paused, sign in required"
          alignItems="center"
          direction="row"
          gap={1}
          onClick={handleAuthRequired}
          testID="sync-paused-auth-indicator"
        >
          <Badge status="warning" value="Sign in to sync" />
        </Box>
      )}
      {queuedCount > 0 && !showProgress && (
        <Box alignItems="center" direction="row" gap={1} testID="sync-queued-count">
          <Badge status="warning" value={`${queuedCount} queued`} />
        </Box>
      )}
      {showProgress && (
        <Box alignItems="center" direction="row" gap={1} testID="sync-drain-progress">
          <Badge status="warning" value={`Syncing ${sentThisDrain} / ${totalThisDrain}`} />
        </Box>
      )}
      {isSyncing && (
        <Text color="secondaryLight" size="sm" testID="sync-syncing-indicator">
          Syncing…
        </Text>
      )}
      {failedCount > 0 && (
        <Box
          accessibilityHint="Opens the failed sync mutations detail view"
          accessibilityLabel="View failed sync mutations"
          alignItems="center"
          direction="row"
          gap={1}
          onClick={handleOpenFailed}
          testID="sync-failed-badge"
        >
          <Badge status="error" value={`${failedCount} failed`} />
        </Box>
      )}
      {conflictCount > 0 && (
        <Box
          accessibilityHint="Opens the sync conflict resolution sheet"
          accessibilityLabel="View sync conflicts"
          accessibilityRole="button"
          alignItems="center"
          direction="row"
          gap={1}
          onClick={handleOpenConflicts}
          testID="sync-conflict-badge"
        >
          <Badge
            status="error"
            value={`${conflictCount} conflict${conflictCount === 1 ? "" : "s"}`}
          />
        </Box>
      )}
    </Box>
  );
};
