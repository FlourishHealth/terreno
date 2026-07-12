import {DateTime} from "luxon";
import {createMergeableStore, type MergeableStore, type Row} from "tinybase";

import {buildTablesSchema, SYNC_SCHEMA_VERSION, SYNC_VALUES_SCHEMA} from "./schema";
import {
  CURSORS_TABLE,
  type EntityRow,
  KNOWN_STREAMS_TABLE,
  RESERVED_TABLE_PREFIX,
  type SyncEntity,
} from "./types";

const encodeData = (data: unknown): string => JSON.stringify(data ?? null);

const decodeData = <TData>(raw: string | undefined): TData => {
  if (raw === undefined) {
    return null as TData;
  }
  try {
    return JSON.parse(raw) as TData;
  } catch (error) {
    // A single corrupt/legacy row must never take down a local-first list read.
    console.warn("[syncdb] failed to decode entity payload; returning null", error);
    return null as TData;
  }
};

const rowToEntity = <TData>(id: string, row: Partial<EntityRow>): SyncEntity<TData> => ({
  data: decodeData<TData>(row.data),
  deleted: Boolean(row.deleted),
  id,
  pendingMutationId: row.pendingMutationId ? row.pendingMutationId : undefined,
  seq: row.seq ?? 0,
  stream: row.stream ? row.stream : undefined,
});

export interface UpsertEntityArgs {
  collection: string;
  id: string;
  data: unknown;
  /** Server seq for this entity; omitted = preserve existing (0 when new). */
  seq?: number;
  /** Tombstone flag; omitted = preserve existing (false when new). */
  deleted?: boolean;
  /** Protecting outbox mutation; omitted = preserve existing, "" = clear. */
  pendingMutationId?: string;
  /** C2: the stream this entity was written under; omitted = preserve existing. */
  stream?: string;
}

export interface SyncStore {
  /** Underlying TinyBase MergeableStore (CRDT-capable, persistence-ready). */
  readonly raw: MergeableStore;
  /** Collections this store was configured with. */
  readonly collections: readonly string[];
  upsertEntity: (args: UpsertEntityArgs) => SyncEntity;
  getEntity: <TData = unknown>(args: {
    collection: string;
    id: string;
  }) => SyncEntity<TData> | undefined;
  listEntities: <TData = unknown>(args: {
    collection: string;
    includeDeleted?: boolean;
  }) => SyncEntity<TData>[];
  softDeleteEntity: (args: {collection: string; id: string}) => void;
  clearCollection: (args: {collection: string}) => void;
  getSchemaVersion: () => number;
  getLastUserId: () => string | undefined;
  setLastUserId: (args: {userId: string}) => void;
  /** C2: stream keys the client has bootstrapped (the persisted membership set). */
  getKnownStreams: () => string[];
  /** C2: record a stream as bootstrapped (join). */
  addKnownStream: (args: {stream: string; collection: string}) => void;
  /** C2: forget a bootstrapped stream (leave). */
  removeKnownStream: (args: {stream: string}) => void;
  /**
   * C2 leave-purge: delete every local entity written under `stream` (matched on the
   * entity `stream` column) across all collections, and its cursor + known-stream entry.
   * Returns the number of entities purged.
   */
  purgeStream: (args: {stream: string}) => number;
}

/**
 * Create a schema-bound TinyBase MergeableStore wrapped with typed,
 * collection-aware entity accessors. A MergeableStore (rather than a plain
 * Store) is used deliberately so the local data is CRDT-ready from day one.
 * Every accessor validates its collection against the configured list so a
 * typo'd collection fails loudly instead of silently writing to a stray table.
 */
export const createSyncStore = ({collections}: {collections: string[]}): SyncStore => {
  for (const collection of collections) {
    if (collection.startsWith(RESERVED_TABLE_PREFIX)) {
      throw new Error(
        `Collection names must not start with "${RESERVED_TABLE_PREFIX}" (reserved for internal tables): ${collection}`
      );
    }
  }
  const known = new Set(collections);
  if (known.size !== collections.length) {
    throw new Error(`Duplicate collection names: ${collections.join(", ")}`);
  }

  const raw = createMergeableStore();
  raw.setTablesSchema(buildTablesSchema({collections}));
  raw.setValuesSchema(SYNC_VALUES_SCHEMA);

  const assertCollection = (collection: string): void => {
    if (!known.has(collection)) {
      throw new Error(`Unknown collection "${collection}" (configured: ${collections.join(", ")})`);
    }
  };

  const upsertEntity = (args: UpsertEntityArgs): SyncEntity => {
    assertCollection(args.collection);
    const existing = raw.hasRow(args.collection, args.id)
      ? (raw.getRow(args.collection, args.id) as Partial<EntityRow>)
      : undefined;
    const row: EntityRow = {
      data: encodeData(args.data),
      deleted: args.deleted ?? existing?.deleted ?? false,
      pendingMutationId: args.pendingMutationId ?? existing?.pendingMutationId ?? "",
      seq: args.seq ?? existing?.seq ?? 0,
      stream: args.stream ?? existing?.stream ?? "",
    };
    raw.setRow(args.collection, args.id, row as unknown as Row);
    return rowToEntity(args.id, row);
  };

  const getEntity = <TData = unknown>(args: {
    collection: string;
    id: string;
  }): SyncEntity<TData> | undefined => {
    assertCollection(args.collection);
    if (!raw.hasRow(args.collection, args.id)) {
      return undefined;
    }
    return rowToEntity<TData>(args.id, raw.getRow(args.collection, args.id) as Partial<EntityRow>);
  };

  const listEntities = <TData = unknown>(args: {
    collection: string;
    includeDeleted?: boolean;
  }): SyncEntity<TData>[] => {
    assertCollection(args.collection);
    const table = raw.getTable(args.collection);
    const entities: SyncEntity<TData>[] = [];
    for (const [id, row] of Object.entries(table)) {
      const entity = rowToEntity<TData>(id, row as Partial<EntityRow>);
      if (!args.includeDeleted && entity.deleted) {
        continue;
      }
      entities.push(entity);
    }
    return entities;
  };

  const softDeleteEntity = (args: {collection: string; id: string}): void => {
    assertCollection(args.collection);
    if (!raw.hasRow(args.collection, args.id)) {
      return;
    }
    raw.setCell(args.collection, args.id, "deleted", true);
  };

  const clearCollection = (args: {collection: string}): void => {
    assertCollection(args.collection);
    raw.delTable(args.collection);
  };

  const getSchemaVersion = (): number => {
    const version = raw.getValue("schemaVersion");
    return typeof version === "number" ? version : SYNC_SCHEMA_VERSION;
  };

  const getLastUserId = (): string | undefined => {
    const userId = raw.getValue("lastUserId");
    return typeof userId === "string" && userId !== "" ? userId : undefined;
  };

  const setLastUserId = ({userId}: {userId: string}): void => {
    raw.setValue("lastUserId", userId);
  };

  const getKnownStreams = (): string[] => Object.keys(raw.getTable(KNOWN_STREAMS_TABLE));

  const addKnownStream = ({stream, collection}: {stream: string; collection: string}): void => {
    raw.setRow(KNOWN_STREAMS_TABLE, stream, {
      addedAt: DateTime.now().toISO(),
      collection,
    } as unknown as Row);
  };

  const removeKnownStream = ({stream}: {stream: string}): void => {
    raw.delRow(KNOWN_STREAMS_TABLE, stream);
  };

  const purgeStream = ({stream}: {stream: string}): number => {
    let purged = 0;
    for (const collection of collections) {
      const table = raw.getTable(collection);
      for (const [id, row] of Object.entries(table)) {
        if ((row as Partial<EntityRow>).stream === stream) {
          raw.delRow(collection, id);
          purged += 1;
        }
      }
    }
    raw.delRow(CURSORS_TABLE, stream);
    removeKnownStream({stream});
    return purged;
  };

  return {
    addKnownStream,
    clearCollection,
    collections,
    getEntity,
    getKnownStreams,
    getLastUserId,
    getSchemaVersion,
    listEntities,
    purgeStream,
    raw,
    removeKnownStream,
    setLastUserId,
    softDeleteEntity,
    upsertEntity,
  };
};
