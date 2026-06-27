import {DateTime} from "luxon";

import type {SyncStore} from "../storage/store";
import {SYNC_TABLES} from "../storage/types";

const nowIso = (): string => DateTime.utc().toISO();

/** How a snapshot is reconciled against the local collection. */
export type SnapshotMode = "merge" | "replace";

/** A single server record in a downloaded snapshot. */
export interface SnapshotRecord<TData = Record<string, unknown>> {
  id: string;
  data: TData;
  version?: string;
  updatedAt?: string;
  /** When true, applies as a (soft) delete instead of an upsert. */
  deleted?: boolean;
}

/** A downloaded snapshot of one collection, optionally with a resume cursor. */
export interface CollectionSnapshot<TData = Record<string, unknown>> {
  collection: string;
  records: SnapshotRecord<TData>[];
  /** Monotonic cursor for the stream after this snapshot (enables later deltas). */
  cursor?: string;
  /** Stream id for the cursor (defaults to the collection). */
  stream?: string;
}

/** Fetches a snapshot for one collection (REST, /sync/snapshot, etc.). */
export type SnapshotFetcher = (args: {
  collection: string;
  since?: string;
}) => Promise<CollectionSnapshot>;

export interface ApplySnapshotResult {
  collection: string;
  /** Number of records upserted/deleted from the snapshot. */
  applied: number;
  /** Number of local rows removed (replace mode only). */
  removed: number;
  cursor?: string;
}

/**
 * Apply a downloaded collection snapshot to the local store.
 *
 * - `merge` (default): upsert each record and keep local-only entities (safe
 *   when there are pending offline mutations).
 * - `replace`: additionally hard-delete local entities in the collection that
 *   are absent from the snapshot, producing an exact mirror (use on a clean
 *   store — it discards local-only rows).
 */
export const applyCollectionSnapshot = <TData = Record<string, unknown>>({
  store,
  snapshot,
  mode = "merge",
}: {
  store: SyncStore;
  snapshot: CollectionSnapshot<TData>;
  mode?: SnapshotMode;
}): ApplySnapshotResult => {
  const incomingIds = new Set(snapshot.records.map((record) => record.id));

  let removed = 0;
  if (mode === "replace") {
    for (const existing of store.getCollectionEntities({
      collection: snapshot.collection,
      includeDeleted: true,
    })) {
      if (!incomingIds.has(existing.id)) {
        store.deleteEntity({collection: snapshot.collection, hard: true, id: existing.id});
        removed += 1;
      }
    }
  }

  let applied = 0;
  for (const record of snapshot.records) {
    if (record.deleted) {
      store.deleteEntity({collection: snapshot.collection, id: record.id});
    } else {
      store.upsertEntity({
        collection: snapshot.collection,
        data: record.data,
        id: record.id,
        updatedAt: record.updatedAt,
        version: record.version,
      });
    }
    applied += 1;
  }

  if (snapshot.cursor !== undefined) {
    const stream = snapshot.stream ?? snapshot.collection;
    store.raw.setRow(SYNC_TABLES.cursors, stream, {
      cursor: snapshot.cursor,
      stream,
      updatedAt: nowIso(),
    });
  }

  return {applied, collection: snapshot.collection, cursor: snapshot.cursor, removed};
};
