import {useSyncStatus} from "@terreno/syncdb/react";
import {Badge, Box, Text} from "@terreno/ui";
import type React from "react";

interface SyncStatusBannerProps {
  /** Opens the conflict sheet; wired to the pressable conflict badge. */
  onOpenConflicts: () => void;
}

/**
 * Compact sync-state banner for syncdb-backed screens: offline indicator, queued
 * mutation count, syncing spinner state, and a pressable conflict badge.
 */
export const SyncStatusBanner: React.FC<SyncStatusBannerProps> = ({onOpenConflicts}) => {
  const status = useSyncStatus();

  return (
    <Box
      alignItems="center"
      direction="row"
      gap={2}
      marginBottom={4}
      testID="sync-status-banner"
      wrap
    >
      {!status.isOnline && (
        <Box alignItems="center" direction="row" gap={1} testID="sync-offline-indicator">
          <Badge status="error" value="Offline" />
        </Box>
      )}
      {status.queuedCount > 0 && (
        <Box alignItems="center" direction="row" gap={1} testID="sync-queued-count">
          <Badge status="warning" value={`${status.queuedCount} queued`} />
        </Box>
      )}
      {status.isSyncing && (
        <Text color="secondaryLight" size="sm" testID="sync-syncing-indicator">
          Syncing…
        </Text>
      )}
      {status.conflictCount > 0 && (
        <Box
          alignItems="center"
          direction="row"
          gap={1}
          onClick={onOpenConflicts}
          testID="sync-conflict-badge"
        >
          <Badge
            status="error"
            value={`${status.conflictCount} conflict${status.conflictCount === 1 ? "" : "s"}`}
          />
        </Box>
      )}
    </Box>
  );
};
