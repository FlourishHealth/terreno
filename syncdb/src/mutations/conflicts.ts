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
  serverDeleted: Boolean(row.serverDeleted),
  serverSeq: row.serverSeq ?? 0,
});

/**
 * A conflict row is only actionable when it still names the entity it belongs
 * to. Stores persisted before the schema dropped its cell defaults can hold
 * husk rows left by TinyBase re-materializing a deleted row's defaults on load
 * (see `buildTablesSchema`); resolving one used to throw `Unknown collection
 * ""`. Reads skip them and {@link pruneGhostConflicts} clears them at startup.
 */
const isActionable = (row: Partial<ConflictRow>): boolean =>
  Boolean(row.collection) && Boolean(row.entityId);

/** Record an unresolved conflict in the `_conflicts` table (rowId = mutationId). */
export const writeConflict = ({
  store,
  conflict,
}: {
  store: SyncStore;
  conflict: SyncConflict;
}): void => {
  const {mutationId, serverDeleted, ...rest} = conflict;
  const row: ConflictRow = {...rest, serverDeleted: Boolean(serverDeleted)};
  store.raw.setRow(CONFLICTS_TABLE, mutationId, row as unknown as Row);
};

/** Read one conflict by its mutationId, or undefined when absent (or a husk row). */
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
  const row = store.raw.getRow(CONFLICTS_TABLE, mutationId) as Partial<ConflictRow>;
  if (!isActionable(row)) {
    return undefined;
  }
  return rowToConflict(mutationId, row);
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
    const typedRow = row as Partial<ConflictRow>;
    if (!isActionable(typedRow)) {
      continue;
    }
    const conflict = rowToConflict(mutationId, typedRow);
    if (!includeDismissed && conflict.dismissed) {
      continue;
    }
    conflicts.push(conflict);
  }
  return conflicts;
};

/**
 * Delete husk `_conflicts` rows (see {@link isActionable}) so they stop
 * inflating conflict counts in a store that persisted them. Returns the
 * mutationIds removed.
 */
export const pruneGhostConflicts = ({store}: {store: SyncStore}): string[] => {
  const removed: string[] = [];
  for (const [mutationId, row] of Object.entries(store.raw.getTable(CONFLICTS_TABLE))) {
    if (isActionable(row as Partial<ConflictRow>)) {
      continue;
    }
    store.raw.delRow(CONFLICTS_TABLE, mutationId);
    removed.push(mutationId);
  }
  return removed;
};
