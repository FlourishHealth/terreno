import {DateTime} from "luxon";
import {createMergeableStore, type MergeableStore, type Row} from "tinybase";

import {SYNC_TABLES_SCHEMA, SYNC_VALUES_SCHEMA} from "./schema";
import {type EntityRow, type LocalEntityRecord, SYNC_TABLES} from "./types";

/** Build the composite TinyBase row id for an entity. */
export const entityKey = ({collection, id}: {collection: string; id: string}): string =>
  `${collection}:${id}`;

const nowIso = (): string => DateTime.utc().toISO();

const encodeData = (data: unknown): string => JSON.stringify(data ?? null);

const decodeData = <TData>(raw: string | undefined): TData => {
  if (!raw) {
    return {} as TData;
  }
  return JSON.parse(raw) as TData;
};

const rowToRecord = <TData>(key: string, row: Partial<EntityRow>): LocalEntityRecord<TData> => ({
  collection: row.collection ?? "",
  data: decodeData<TData>(row.data),
  deleted: Boolean(row.deleted),
  id: row.entityId ?? "",
  key,
  updatedAt: row.updatedAt ?? "",
  version: row.version ? row.version : undefined,
});

export interface UpsertEntityArgs<TData> {
  collection: string;
  id: string;
  data: TData;
  updatedAt?: string;
  version?: string;
  deleted?: boolean;
}

export interface SyncStore {
  /** Underlying TinyBase MergeableStore (CRDT-capable, persistence-ready). */
  readonly raw: MergeableStore;
  upsertEntity<TData>(args: UpsertEntityArgs<TData>): LocalEntityRecord<TData>;
  getEntity<TData>(args: {collection: string; id: string}): LocalEntityRecord<TData> | undefined;
  getCollectionEntities<TData>(args: {
    collection: string;
    includeDeleted?: boolean;
  }): LocalEntityRecord<TData>[];
  deleteEntity(args: {collection: string; id: string; hard?: boolean}): void;
  clear(): void;
}

export interface CreateSyncStoreArgs {
  /** Optional deterministic id (mainly for tests/HLC determinism). */
  storeId?: string;
}

/**
 * Create a schema-bound TinyBase MergeableStore wrapped with typed,
 * collection-aware entity accessors. A MergeableStore (rather than a plain
 * Store) is used deliberately so the local data is CRDT-ready from day one; see
 * the package README for the Yjs/CRDT migration rationale.
 */
export const createSyncStore = ({storeId}: CreateSyncStoreArgs = {}): SyncStore => {
  const raw = createMergeableStore(storeId);
  raw.setTablesSchema(SYNC_TABLES_SCHEMA);
  raw.setValuesSchema(SYNC_VALUES_SCHEMA);

  const upsertEntity = <TData>(args: UpsertEntityArgs<TData>): LocalEntityRecord<TData> => {
    const key = entityKey({collection: args.collection, id: args.id});
    const updatedAt = args.updatedAt ?? nowIso();
    const row: EntityRow = {
      collection: args.collection,
      data: encodeData(args.data),
      deleted: args.deleted ?? false,
      entityId: args.id,
      updatedAt,
      version: args.version ?? "",
    };
    raw.setRow(SYNC_TABLES.entities, key, row as unknown as Row);
    return rowToRecord<TData>(key, row);
  };

  const getEntity = <TData>(args: {
    collection: string;
    id: string;
  }): LocalEntityRecord<TData> | undefined => {
    const key = entityKey(args);
    if (!raw.hasRow(SYNC_TABLES.entities, key)) {
      return undefined;
    }
    return rowToRecord<TData>(key, raw.getRow(SYNC_TABLES.entities, key) as Partial<EntityRow>);
  };

  const getCollectionEntities = <TData>(args: {
    collection: string;
    includeDeleted?: boolean;
  }): LocalEntityRecord<TData>[] => {
    const table = raw.getTable(SYNC_TABLES.entities);
    const records: LocalEntityRecord<TData>[] = [];
    for (const [key, row] of Object.entries(table)) {
      const typedRow = row as Partial<EntityRow>;
      if (typedRow.collection !== args.collection) {
        continue;
      }
      if (!args.includeDeleted && Boolean(typedRow.deleted)) {
        continue;
      }
      records.push(rowToRecord<TData>(key, typedRow));
    }
    return records;
  };

  const deleteEntity = (args: {collection: string; id: string; hard?: boolean}): void => {
    const key = entityKey(args);
    if (args.hard) {
      raw.delRow(SYNC_TABLES.entities, key);
      return;
    }
    if (!raw.hasRow(SYNC_TABLES.entities, key)) {
      return;
    }
    raw.setCell(SYNC_TABLES.entities, key, "deleted", true);
    raw.setCell(SYNC_TABLES.entities, key, "updatedAt", nowIso());
  };

  const clear = (): void => {
    raw.delTable(SYNC_TABLES.entities);
  };

  return {
    clear,
    deleteEntity,
    getCollectionEntities,
    getEntity,
    raw,
    upsertEntity,
  };
};
