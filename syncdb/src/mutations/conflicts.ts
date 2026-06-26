import {DateTime} from "luxon";
import type {MergeableStore, Row} from "tinybase";

import {SYNC_TABLES, type SyncConflict} from "../storage/types";

const nowIso = (): string => DateTime.utc().toISO();

const generateId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `cf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const encode = (value: unknown): string => JSON.stringify(value ?? {});

const decode = <T>(raw: string | undefined): T => {
  if (!raw) {
    return {} as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn("[syncdb] failed to decode conflict payload; returning empty", error);
    return {} as T;
  }
};

interface ConflictRow {
  collection: string;
  createdAt: string;
  dismissed: boolean;
  entityId: string;
  localData: string;
  mutationId: string;
  serverData: string;
}

const rowToConflict = <T>(conflictId: string, row: Partial<ConflictRow>): SyncConflict<T> => ({
  collection: row.collection ?? "",
  conflictId,
  createdAt: row.createdAt ?? "",
  dismissed: Boolean(row.dismissed),
  entityId: row.entityId ?? "",
  localData: decode<T>(row.localData),
  mutationId: row.mutationId ?? "",
  serverData: decode<T>(row.serverData),
});

export interface CaptureConflictArgs<T> {
  mutationId: string;
  collection: string;
  entityId: string;
  localData: T;
  serverData: T;
  conflictId?: string;
  createdAt?: string;
}

export interface ConflictStore {
  capture<T>(args: CaptureConflictArgs<T>): SyncConflict<T>;
  get<T>(args: {conflictId: string}): SyncConflict<T> | undefined;
  list<T>(args?: {includeDismissed?: boolean}): SyncConflict<T>[];
  count(args?: {includeDismissed?: boolean}): number;
  dismiss(args: {conflictId: string}): void;
  remove(args: {conflictId: string}): void;
  clear(): void;
}

/** TinyBase-backed store of unresolved conflicts awaiting user resolution. */
export const createConflictStore = ({store}: {store: MergeableStore}): ConflictStore => {
  const capture = <T>(args: CaptureConflictArgs<T>): SyncConflict<T> => {
    const conflictId = args.conflictId ?? generateId();
    const row: ConflictRow = {
      collection: args.collection,
      createdAt: args.createdAt ?? nowIso(),
      dismissed: false,
      entityId: args.entityId,
      localData: encode(args.localData),
      mutationId: args.mutationId,
      serverData: encode(args.serverData),
    };
    store.setRow(SYNC_TABLES.conflicts, conflictId, row as unknown as Row);
    return rowToConflict<T>(conflictId, row);
  };

  const get = <T>({conflictId}: {conflictId: string}): SyncConflict<T> | undefined => {
    if (!store.hasRow(SYNC_TABLES.conflicts, conflictId)) {
      return undefined;
    }
    return rowToConflict<T>(
      conflictId,
      store.getRow(SYNC_TABLES.conflicts, conflictId) as Partial<ConflictRow>
    );
  };

  const list = <T>({includeDismissed}: {includeDismissed?: boolean} = {}): SyncConflict<T>[] => {
    const table = store.getTable(SYNC_TABLES.conflicts);
    const conflicts: SyncConflict<T>[] = [];
    for (const [conflictId, row] of Object.entries(table)) {
      const conflict = rowToConflict<T>(conflictId, row as Partial<ConflictRow>);
      if (!includeDismissed && conflict.dismissed) {
        continue;
      }
      conflicts.push(conflict);
    }
    conflicts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return conflicts;
  };

  const count = ({includeDismissed}: {includeDismissed?: boolean} = {}): number =>
    list({includeDismissed}).length;

  const dismiss = ({conflictId}: {conflictId: string}): void => {
    if (!store.hasRow(SYNC_TABLES.conflicts, conflictId)) {
      return;
    }
    store.setCell(SYNC_TABLES.conflicts, conflictId, "dismissed", true);
  };

  const remove = ({conflictId}: {conflictId: string}): void => {
    store.delRow(SYNC_TABLES.conflicts, conflictId);
  };

  const clear = (): void => {
    store.delTable(SYNC_TABLES.conflicts);
  };

  return {capture, clear, count, dismiss, get, list, remove};
};
