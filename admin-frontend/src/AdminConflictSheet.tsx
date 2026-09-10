import {
  ConflictSheet,
  type SyncConflictItem,
  type SyncConflictResolutionStrategy,
} from "@terreno/ui";
import React, {useCallback, useMemo, useState} from "react";

export interface AdminConflictSheetProps {
  collection: string;
  conflicts: SyncConflictItem[];
  loadedIds: string[];
  resolve: (args: {mutationId: string; strategy: SyncConflictResolutionStrategy}) => void;
}

/**
 * Connects a host's `useConflicts()` result to the shared conflict UI while
 * limiting the sheet to entities loaded through an admin window.
 */
export const AdminConflictSheet: React.FC<AdminConflictSheetProps> = ({
  collection,
  conflicts,
  loadedIds,
  resolve,
}) => {
  const [dismissedConflictKey, setDismissedConflictKey] = useState<string | undefined>();

  const adminConflicts = useMemo((): SyncConflictItem[] => {
    const loadedIdSet = new Set(loadedIds);
    return conflicts.filter(
      (conflict) => conflict.collection === collection && loadedIdSet.has(conflict.entityId)
    );
  }, [collection, conflicts, loadedIds]);

  const conflictKey = useMemo(
    (): string =>
      adminConflicts
        .map(({mutationId}) => mutationId)
        .sort()
        .join("|"),
    [adminConflicts]
  );
  const handleDismiss = useCallback((): void => {
    setDismissedConflictKey(conflictKey);
  }, [conflictKey]);

  if (adminConflicts.length === 0) {
    return null;
  }

  return (
    <ConflictSheet
      conflicts={adminConflicts}
      onDismiss={handleDismiss}
      onResolve={resolve}
      testID="admin-conflict-sheet"
      title="Admin changes don't match"
      visible={dismissedConflictKey !== conflictKey}
    />
  );
};
