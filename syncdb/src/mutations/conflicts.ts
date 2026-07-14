import type {Row} from "tinybase";

import type {SyncStore} from "../storage/store";
import {CONFLICTS_TABLE, type ConflictRow} from "../storage/types";
import type {SyncConflict} from "../types";

const rowToConflict = (mutationId: string, row: Partial<ConflictRow>): SyncConflict => ({
  collection: row.collection ?? "",
  dismissed: Boolean(row.dismissed),
  entityId: row.entityId ?? "",
  localData: row.localData ?? "null",
  mutationId,
  serverData: row.serverData ?? "null",
  serverSeq: row.serverSeq ?? 0,
});

/** Record an unresolved conflict in the `_conflicts` table (rowId = mutationId). */
export const writeConflict = ({
  store,
  conflict,
}: {
  store: SyncStore;
  conflict: SyncConflict;
}): void => {
  const {mutationId, ...row} = conflict;
  store.raw.setRow(CONFLICTS_TABLE, mutationId, row as unknown as Row);
};

/** Read one conflict by its mutationId, or undefined when absent. */
export const getConflict = ({
  store,
  mutationId,
}: {
  store: SyncStore;
  mutationId: string;
}): SyncConflict | undefined => {
  if (!store.raw.hasRow(CONFLICTS_TABLE, mutationId)) {
    return undefined;
  }
  return rowToConflict(
    mutationId,
    store.raw.getRow(CONFLICTS_TABLE, mutationId) as Partial<ConflictRow>
  );
};

/** Remove a conflict row (after resolution). */
export const deleteConflict = ({
  store,
  mutationId,
}: {
  store: SyncStore;
  mutationId: string;
}): void => {
  store.raw.delRow(CONFLICTS_TABLE, mutationId);
};

/** All unresolved conflicts (dismissed rows excluded unless requested). */
export const listConflicts = ({
  store,
  includeDismissed = false,
}: {
  store: SyncStore;
  includeDismissed?: boolean;
}): SyncConflict[] => {
  const conflicts: SyncConflict[] = [];
  for (const [mutationId, row] of Object.entries(store.raw.getTable(CONFLICTS_TABLE))) {
    const conflict = rowToConflict(mutationId, row as Partial<ConflictRow>);
    if (!includeDismissed && conflict.dismissed) {
      continue;
    }
    conflicts.push(conflict);
  }
  return conflicts;
};
