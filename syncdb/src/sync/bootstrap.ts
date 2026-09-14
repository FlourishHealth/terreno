/**
 * Snapshot bootstrap: page `GET /sync/snapshot` per STREAM into the local store until
 * the server reports no more pages.
 *
 * ## Cursor semantics (C2 — per-stream cursors)
 *
 * Bootstrap pages one stream per request (the server resolves the stream's scope from
 * the stream key and pages by `_syncSeq`). Progress is kept in `_cursors` keyed by the
 * REAL stream key (the same key deltas advance) — the old `snapshot:{collection}`
 * pseudo-cursors are gone. Snapshot entities are applied with the same protections as
 * `applyDelta`: entities protected by a pending outbox mutation are never overwritten,
 * and stale seqs are skipped.
 *
 * Two progress cells, not one: `snapshotSeq` (how far this stream has been PAGED) is
 * tracked separately from `seq` (the highest applied seq, which deltas also advance).
 * An unfinished bootstrap resumes from `snapshotSeq`, because a live delta at the stream
 * head can overtake the applied-seq cursor mid-bootstrap — resuming there would leave
 * every unpaged seq below it permanently unreachable. Once a pass reaches the head, the
 * stream is marked `bootstrapped` and catch-up resumes from `seq` (deltas carry their own
 * data, so nothing below it needs paging).
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
import {
  getCursor,
  getSnapshotCursor,
  isStreamBootstrapped,
  markStreamBootstrapped,
  setCursor,
  setSnapshotCursor,
} from "./cursor";
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
    store.markNeedsRepair({
      collection,
      entityId: entity.id,
      missedSeq: entity.seq,
      stream,
    });
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
  store.clearNeedsRepair({collection, entityId: entity.id});
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
  // Until a snapshot pass has reached the stream head, resume from snapshot progress
  // (`snapshotSeq`) rather than the applied-seq cursor: a live delta can push the latter
  // to the head mid-bootstrap, and resuming there would skip every unpaged seq below it
  // forever. Once bootstrapped, the applied-seq cursor IS the correct catch-up point.
  const bootstrapped = isStreamBootstrapped({store, stream});
  let cursor = bootstrapped ? getCursor({store, stream}) : getSnapshotCursor({store, stream});
  let legacyCursor: string | undefined;
  let hasMore = true;
  let retentionChecked = false;
  /** True when the server itself reported the stream head was reached. */
  let reachedHead = false;

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

    if (page.legacyCursor !== undefined) {
      // C3: still draining the seq-0 stratum — echo the token, cursor stays 0. Apply the
      // whole page in one transaction (E4) so listeners/autosave fire once per page.
      const applied = store.raw.transaction(() => {
        let count = 0;
        for (const entity of page.entities) {
          if (applySnapshotEntity({collection, entity, store, stream})) {
            count += 1;
          }
        }
        return count;
      });
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
    const madeProgress = clampedCursor > cursor;
    // E4: apply the whole page plus its cursor advance inside ONE store transaction —
    // TinyBase batches listener notifications (and the autosave persister's
    // did-finish-transaction write) to fire ONCE per transaction rather than once per
    // row. Without this, a page of N entities triggers N table-listener calls (and N
    // autosave attempts) instead of one, which is O(N²) across a full bootstrap.
    const applied = store.raw.transaction(() => {
      let count = 0;
      for (const entity of page.entities) {
        if (applySnapshotEntity({collection, entity, store, stream})) {
          count += 1;
        }
      }
      if (madeProgress) {
        setCursor({now, seq: clampedCursor, store, stream});
        setSnapshotCursor({seq: clampedCursor, store, stream});
      }
      return count;
    });
    // Guard against a server reporting hasMore without advancing (would loop forever).
    hasMore = page.hasMore && madeProgress;
    // Only the server saying "no more pages" proves the head was reached; exiting via the
    // guard above means the pass is incomplete and must resume from snapshot progress.
    reachedHead = !page.hasMore;
    cursor = Math.max(cursor, clampedCursor);
    onProgress?.({applied, collection, cursor, fetched: page.entities.length, hasMore, stream});
  }

  if (reachedHead) {
    markStreamBootstrapped({store, stream});
  }
};
