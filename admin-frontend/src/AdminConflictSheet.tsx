import {
  ConflictSheet,
  type SyncConflictItem,
  type SyncConflictResolutionStrategy,
} from "@terreno/ui";
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {agentAdminLog, installAgentLogDumper} from "./adminFormDebug";

installAgentLogDumper();

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
  const renderCountRef = useRef(0);
  const mountGenerationRef = useRef(Math.random().toString(36).slice(2, 10));

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

  renderCountRef.current += 1;
  agentAdminLog("AdminConflictSheet", "H6", "render", {
    adminConflictCount: adminConflicts.length,
    conflictKey,
    isDismissed,
    mountGeneration: mountGenerationRef.current,
    renderCount: renderCountRef.current,
  });

  useEffect(() => {
    agentAdminLog("AdminConflictSheet", "H6", "mount", {
      collection,
      loadedIdKey,
      mountGeneration: mountGenerationRef.current,
    });
    return () => {
      agentAdminLog("AdminConflictSheet", "H6", "unmount", {
        collection,
        mountGeneration: mountGenerationRef.current,
        renderCount: renderCountRef.current,
      });
    };
  }, [collection, loadedIdKey]);

  const handleDismiss = useCallback((): void => {
    agentAdminLog("AdminConflictSheet", "H6", "dismiss", {
      adminConflictCount: adminConflicts.length,
      conflictKey,
    });
    setIsDismissed(true);
  }, [adminConflicts.length, conflictKey]);

  // A new mutation-id set is a fresh conflict episode — reopen after an earlier dismiss.
  // Skip the empty key: clearing conflicts also sets conflictKey to "" and must not
  // undo ConflictSheet's onDismiss in the same episode.
  useEffect(() => {
    agentAdminLog("AdminConflictSheet", "H6", "conflictKey effect run", {
      conflictKey,
      isDismissed,
    });
    if (conflictKey.length > 0) {
      agentAdminLog("AdminConflictSheet", "H6", "conflictKey effect reopen", {conflictKey});
      setIsDismissed(false);
    }
  }, [conflictKey]);

  // Admin unmounts ConflictSheet when the window has no conflicts; reset so the next
  // episode does not inherit a stale dismissed flag.
  useEffect(() => {
    agentAdminLog("AdminConflictSheet", "H6", "adminConflicts.length effect run", {
      adminConflictCount: adminConflicts.length,
      isDismissed,
    });
    if (adminConflicts.length === 0) {
      agentAdminLog("AdminConflictSheet", "H6", "adminConflicts.length effect reset dismiss", {});
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
