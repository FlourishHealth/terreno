/**
 * Snapshot bootstrap: page `GET /sync/snapshot` per collection into the local
 * store until the server reports no more pages.
 *
 * ## Cursor semantics — snapshot vs stream cursors
 *
 * Deltas carry a `stream` key (e.g. "todos|owner:123") and advance per-stream
 * cursors in `_cursors`, but snapshot entities do NOT carry their stream — the
 * server pages a whole collection (already scope-filtered to the caller) by
 * `_syncSeq` ascending. Bootstrap therefore keeps its own per-collection
 * resume cursor in `_cursors` under the reserved key `snapshot:{collection}`,
 * a namespace disjoint from real delta stream keys (which are
 * `{collection}|{scope}:{value}` shaped). Snapshot entities are applied
 * directly through the store
 * accessors with the same protections as `applyDelta`: entities protected by a
 * pending outbox mutation are never overwritten, and stale seqs are skipped.
 */

import type {SyncStore} from "../storage/store";
import type {SyncSnapshotEntity} from "../types";
import {getCursor, setCursor} from "./cursor";
import type {HttpChannel} from "./httpChannel";

/** The `_cursors` row key holding a collection's snapshot resume cursor. */
export const snapshotCursorStream = (collection: string): string => `snapshot:${collection}`;

export interface BootstrapProgress {
  collection: string;
  /** Entities in the page just fetched. */
  fetched: number;
  /** Entities from that page actually written locally (rest were protected/stale). */
  applied: number;
  /** The collection's snapshot cursor after this page. */
  cursor: number;
  /** True when more pages remain for this collection. */
  hasMore: boolean;
}

/**
 * Apply one snapshot entity with `applyDelta`-equivalent protections. Returns
 * true when the entity was written locally.
 */
const applySnapshotEntity = ({
  store,
  collection,
  entity,
}: {
  store: SyncStore;
  collection: string;
  entity: SyncSnapshotEntity;
}): boolean => {
  const existing = store.getEntity({collection, id: entity.id});
  if (existing && entity.seq <= existing.seq) {
    return false;
  }
  if (existing?.pendingMutationId) {
    // Optimistic local state is protected until its mutation resolves.
    return false;
  }
  store.upsertEntity({
    collection,
    data: entity.data,
    deleted: entity.deleted,
    id: entity.id,
    pendingMutationId: "",
    seq: entity.seq,
  });
  return true;
};

/**
 * Page every listed collection from its current snapshot cursor to the head of
 * the server's data. Used for the initial bootstrap and for reconcile
 * (snapshot-from-cursor); both are incremental because the cursor persists.
 */
export const bootstrapCollections = async ({
  store,
  channel,
  collections,
  limit,
  onProgress,
  now,
}: {
  store: SyncStore;
  channel: Pick<HttpChannel, "fetchSnapshotPage">;
  collections: string[];
  /** Page size forwarded to the server (server default when omitted). */
  limit?: number;
  onProgress?: (progress: BootstrapProgress) => void;
  now?: () => string;
}): Promise<void> => {
  for (const collection of collections) {
    const stream = snapshotCursorStream(collection);
    let cursor = getCursor({store, stream});
    let hasMore = true;
    while (hasMore) {
      const page = await channel.fetchSnapshotPage({collection, cursor, limit});
      let applied = 0;
      for (const entity of page.entities) {
        if (applySnapshotEntity({collection, entity, store})) {
          applied += 1;
        }
      }
      if (page.cursor > cursor) {
        setCursor({now, seq: page.cursor, store, stream});
      }
      // Guard against a server bug reporting hasMore without advancing the
      // cursor, which would loop forever re-fetching the same page.
      hasMore = page.hasMore && page.cursor > cursor;
      cursor = Math.max(cursor, page.cursor);
      onProgress?.({applied, collection, cursor, fetched: page.entities.length, hasMore});
    }
  }
};
