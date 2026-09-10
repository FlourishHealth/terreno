import {
  ConflictSheet,
  type SyncConflictItem,
  type SyncConflictResolutionStrategy,
} from "@terreno/ui";
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";

// #region agent log
const debugAdminConflictLog = (
  hypothesisId: string,
  message: string,
  data: Record<string, unknown>
): void => {
  const payload = {
    data,
    hypothesisId,
    location: "AdminConflictSheet.tsx",
    message,
    timestamp: Date.now(),
  };
  console.warn("[agent:AdminConflictSheet]", JSON.stringify(payload));
  fetch("http://localhost:7242/ingest/0a6a6f42-642a-4d7c-b7e1-5b4a3b2c9f1e", {
    body: JSON.stringify(payload),
    headers: {"Content-Type": "application/json", "X-Debug-Session-Id": "de61"},
    method: "POST",
  }).catch(() => {});
};
let adminConflictSheetInstanceCounter = 0;

// #endregion

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
  const instanceIdRef = useRef<number>();
  if (instanceIdRef.current === undefined) {
    adminConflictSheetInstanceCounter += 1;
    instanceIdRef.current = adminConflictSheetInstanceCounter;
  }
  const [dismissedConflictKey, setDismissedConflictKey] = useState<string | undefined>();
  const renderCountRef = useRef(0);
  const prevLoadedIdsRef = useRef<string[] | undefined>();
  const prevConflictsRef = useRef<SyncConflictItem[] | undefined>();

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
    // #region agent log
    debugAdminConflictLog("H2", "handleDismiss called", {
      collection,
      conflictKey,
      dismissedConflictKey,
    });
    // #endregion
    setDismissedConflictKey(conflictKey);
  }, [collection, conflictKey]);

  renderCountRef.current += 1;
  const visible = dismissedConflictKey !== conflictKey;
  const loadedIdsIdentityChanged = prevLoadedIdsRef.current !== loadedIds;
  const conflictsIdentityChanged = prevConflictsRef.current !== conflicts;
  prevLoadedIdsRef.current = loadedIds;
  prevConflictsRef.current = conflicts;

  // #region agent log
  useEffect(() => {
    debugAdminConflictLog("H1", "AdminConflictSheet render snapshot", {
      adminConflictsCount: adminConflicts.length,
      collection,
      conflictKey,
      conflictsIdentityChanged,
      conflictsTotal: conflicts.length,
      dismissedConflictKey,
      instanceId: instanceIdRef.current,
      loadedIds,
      loadedIdsIdentityChanged,
      renderCount: renderCountRef.current,
      visible,
    });
    if (renderCountRef.current > 50) {
      debugAdminConflictLog("H5", "AdminConflictSheet high render count", {
        adminConflictsCount: adminConflicts.length,
        collection,
        conflictKey,
        dismissedConflictKey,
        renderCount: renderCountRef.current,
        visible,
      });
    }
  });
  // #endregion

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
      visible={visible}
    />
  );
};
