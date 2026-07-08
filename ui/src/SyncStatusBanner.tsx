import type React from "react";
import {useCallback} from "react";

import {Badge} from "./Badge";
import {Box} from "./Box";
import {Text} from "./Text";

export interface SyncStatusBannerProps {
  /** Whether the client currently has connectivity. */
  isOnline: boolean;
  /** Number of mutations waiting in the durable outbox. */
  queuedCount: number;
  /** Whether a sync/replay is currently in flight. */
  isSyncing: boolean;
  /** Number of unresolved conflicts. */
  conflictCount: number;
  /** Opens the conflict resolution UI; wired to the pressable conflict badge. */
  onOpenConflicts?: () => void;
  testID?: string;
}

/**
 * Compact, presentational sync-state banner for local-first (e.g. @terreno/syncdb) screens:
 * offline indicator, queued mutation count, syncing state, and a pressable conflict badge. It is
 * intentionally data-driven (no data-layer imports) so it can be reused with any sync store — wire
 * a status hook (such as `useSyncStatus`) to its props in the consuming app.
 */
export const SyncStatusBanner: React.FC<SyncStatusBannerProps> = ({
  isOnline,
  queuedCount,
  isSyncing,
  conflictCount,
  onOpenConflicts,
  testID = "sync-status-banner",
}) => {
  const handleOpenConflicts = useCallback((): void => {
    onOpenConflicts?.();
  }, [onOpenConflicts]);

  return (
    <Box direction="row" gap={2} marginBottom={4} testID={testID} wrap>
      {!isOnline && (
        <Box alignItems="center" direction="row" gap={1} testID="sync-offline-indicator">
          <Badge status="error" value="Offline" />
        </Box>
      )}
      {queuedCount > 0 && (
        <Box alignItems="center" direction="row" gap={1} testID="sync-queued-count">
          <Badge status="warning" value={`${queuedCount} queued`} />
        </Box>
      )}
      {isSyncing && (
        <Text color="secondaryLight" size="sm" testID="sync-syncing-indicator">
          Syncing…
        </Text>
      )}
      {conflictCount > 0 && (
        <Box
          accessibilityHint="Opens the sync conflict resolution sheet"
          accessibilityLabel="View sync conflicts"
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
