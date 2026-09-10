import {
  ConflictSheet,
  type SyncConflictItem,
  type SyncConflictResolutionStrategy,
} from "@terreno/ui";
import React, {useCallback, useEffect, useMemo, useState} from "react";

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
  const [isDismissed, setIsDismissed] = useState(false);

  const loadedIdKey = useMemo((): string => [...loadedIds].sort().join("|"), [loadedIds]);

  const adminConflicts = useMemo((): SyncConflictItem[] => {
    const loadedIdSet = new Set(loadedIds);
    return conflicts.filter(
      (conflict) => conflict.collection === collection && loadedIdSet.has(conflict.entityId)
    );
  }, [collection, conflicts, loadedIdKey, loadedIds]);

  const conflictKey = useMemo(
    (): string =>
      adminConflicts
        .map(({mutationId}) => mutationId)
        .sort()
        .join("|"),
    [adminConflicts]
  );

  const handleDismiss = useCallback((): void => {
    setIsDismissed(true);
  }, []);

  // A new mutation-id set is a fresh conflict episode — reopen after an earlier dismiss.
  // Skip the empty key: clearing conflicts also sets conflictKey to "" and must not
  // undo ConflictSheet's onDismiss in the same episode.
  useEffect(() => {
    if (conflictKey.length > 0) {
      setIsDismissed(false);
    }
  }, [conflictKey]);

  // Admin unmounts ConflictSheet when the window has no conflicts; reset so the next
  // episode does not inherit a stale dismissed flag.
  useEffect(() => {
    if (adminConflicts.length === 0) {
      setIsDismissed(false);
    }
  }, [adminConflicts.length]);

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
      visible={!isDismissed}
    />
  );
};
