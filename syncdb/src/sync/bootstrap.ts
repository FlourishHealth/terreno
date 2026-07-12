/**
 * Snapshot bootstrap: page `GET /sync/snapshot` per STREAM into the local store until
 * the server reports no more pages.
 *
 * ## Cursor semantics (C2 — per-stream cursors)
 *
 * Bootstrap pages one stream per request (the server resolves the stream's scope from
 * the stream key and pages by `_syncSeq`). The resume cursor is kept in `_cursors` keyed
 * by the REAL stream key (the same key deltas advance) — the old `snapshot:{collection}`
 * pseudo-cursors are gone. Snapshot entities are applied with the same protections as
 * `applyDelta`: entities protected by a pending outbox mutation are never overwritten,
 * and stale seqs are skipped.
 *
 * ## Frontier & retention (C1/C7)
 *
 * The client never advances a stream's cursor past the server-reported `frontierSeq`.
 * If the stored cursor is below the response's `oldestRetainedSeq`, compacted tombstones
 * may have been missed → the stream is purged and re-bootstrapped from 0 (a sanctioned
 * retention-gap wipe, distinct from an auth wipe — INV-2).
 *
 * ## Legacy stratum (C3)
 *
 * While the server returns a `legacyCursor`, bootstrap echoes it back verbatim to drain
 * the seq-0 (unstamped) stratum by `_id` before proceeding to seq paging.
 */

import type {SyncStore} from "../storage/store";
import type {SyncSnapshotEntity} from "../types";
import {getCursor, setCursor} from "./cursor";
import type {HttpChannel} from "./httpChannel";

export interface BootstrapProgress {
  /** The stream just paged. */
  stream: string;
  collection: string;
  /** Entities in the page just fetched. */
  fetched: number;
  /** Entities from that page actually written locally (rest were protected/stale). */
  applied: number;
  /** The stream's cursor after this page. */
  cursor: number;
  /** True when more pages remain for this stream. */
  hasMore: boolean;
}

/**
 * Apply one snapshot entity with `applyDelta`-equivalent protections. Returns true when
 * the entity was written locally. Records the stream so leave-purge is O(stream).
 */
const applySnapshotEntity = ({
  store,
  collection,
  stream,
  entity,
}: {
  store: SyncStore;
  collection: string;
  stream: string;
  entity: SyncSnapshotEntity;
}): boolean => {
  const existing = store.getEntity({collection, id: entity.id});
  // Seq-0 legacy entities always apply on first sight (existing seq is also 0); a stamped
  // entity at or below the applied seq is a stale/duplicate page and is skipped.
  if (existing && entity.seq > 0 && entity.seq <= existing.seq) {
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
    stream,
  });
  return true;
};

/**
 * Page a single stream from its current cursor to the server's head. Handles the C3
 * legacy stratum (echoing `legacyCursor`), C1 frontier clamping, and C7 retention-gap
 * re-bootstrap. Idempotent and incremental — safe to call for both initial bootstrap and
 * reconcile.
 */
export const bootstrapStream = async ({
  store,
  channel,
  stream,
  collection,
  limit,
  onProgress,
  now,
}: {
  store: SyncStore;
  channel: Pick<HttpChannel, "fetchSnapshotPage">;
  stream: string;
  collection: string;
  limit?: number;
  onProgress?: (progress: BootstrapProgress) => void;
  now?: () => string;
}): Promise<void> => {
  let cursor = getCursor({store, stream});
  let legacyCursor: string | undefined;
  let hasMore = true;
  let retentionChecked = false;

  while (hasMore) {
    const page = await channel.fetchSnapshotPage({cursor, legacyCursor, limit, stream});

    // C7: a stored cursor below the retained floor means compacted tombstones were
    // missed — purge and re-bootstrap this stream from 0 exactly once.
    if (!retentionChecked) {
      retentionChecked = true;
      if (cursor > 0 && cursor < page.oldestRetainedSeq) {
        store.purgeStream({stream});
        store.addKnownStream({collection, stream});
        cursor = 0;
        legacyCursor = undefined;
        continue;
      }
    }

    let applied = 0;
    for (const entity of page.entities) {
      if (applySnapshotEntity({collection, entity, store, stream})) {
        applied += 1;
      }
    }

    if (page.legacyCursor !== undefined) {
      // C3: still draining the seq-0 stratum — echo the token, cursor stays 0.
      const advanced = page.legacyCursor !== legacyCursor;
      legacyCursor = page.legacyCursor;
      hasMore = advanced;
      onProgress?.({
        applied,
        collection,
        cursor: 0,
        fetched: page.entities.length,
        hasMore,
        stream,
      });
      continue;
    }
    // Legacy stratum done (or never present) — proceed by seq.
    legacyCursor = undefined;

    // C1: never advance past the stable frontier; the server already clamped page.cursor.
    const clampedCursor = Math.min(page.cursor, page.frontierSeq);
    if (clampedCursor > cursor) {
      setCursor({now, seq: clampedCursor, store, stream});
    }
    // Guard against a server reporting hasMore without advancing (would loop forever).
    const madeProgress = clampedCursor > cursor;
    hasMore = page.hasMore && madeProgress;
    cursor = Math.max(cursor, clampedCursor);
    onProgress?.({applied, collection, cursor, fetched: page.entities.length, hasMore, stream});
  }
};
