import type {SyncStore} from "../storage/store";
import type {SyncDelta} from "../types";
import {getCursor, setCursor} from "./cursor";

export interface ApplyDeltaResult {
  /** True when the delta changed local entity state (false = idempotent skip). */
  applied: boolean;
  /**
   * True when the delta's seq jumped past cursor + 1 (measured BEFORE
   * applying). A reconcile hint, not an error: permission-filtered deltas
   * legitimately skip seqs, so downstream rate-limits the reconcile.
   */
  seqJump: boolean;
}

/**
 * Apply a server delta to the local store, idempotently:
 *
 * - a delta at or below the entity's applied seq is skipped (duplicate /
 *   out-of-order delivery);
 * - an entity with a pending outbox mutation is never overwritten — its
 *   optimistic state is protected until conflict resolution decides;
 * - create/update writes data + seq; tombstones set `deleted: true` (keeping
 *   the last known data for conflict UIs);
 * - the cursor for `delta.stream` advances in every case (including skips), so
 *   a skipped delta is never re-fetched on catch-up.
 */
export const applyDelta = ({
  store,
  delta,
  now,
}: {
  store: SyncStore;
  delta: SyncDelta;
  now?: () => string;
}): ApplyDeltaResult => {
  // C1: never advance the cursor past the stream's stable frontier. A delta can arrive
  // for seq N while N-1's claim is still uncommitted (out-of-commit-order); clamping to
  // min(seq, frontierSeq) means the cursor never skips the still-pending hole. Older
  // servers omit frontierSeq — treat it as the delta's own seq (no clamp).
  const frontier = typeof delta.frontierSeq === "number" ? delta.frontierSeq : delta.seq;
  const cursorTarget = Math.min(delta.seq, frontier);
  const seqJump = delta.seq > getCursor({store, stream: delta.stream}) + 1;
  const advanceCursor = (): void => {
    setCursor({now, seq: cursorTarget, store, stream: delta.stream});
  };

  const existing = store.getEntity({collection: delta.collection, id: delta.id});
  if (existing && delta.seq <= existing.seq) {
    advanceCursor();
    return {applied: false, seqJump};
  }
  if (existing?.pendingMutationId) {
    advanceCursor();
    return {applied: false, seqJump};
  }

  const deleted = delta.deleted === true || delta.method === "delete";
  store.upsertEntity({
    collection: delta.collection,
    // Tombstone deltas omit data; keep the last known payload for conflict UIs.
    data: delta.data !== undefined ? delta.data : (existing?.data ?? null),
    deleted,
    id: delta.id,
    pendingMutationId: "",
    seq: delta.seq,
    // C2: record the stream so leave-purge can drop this entity in O(stream).
    stream: delta.stream,
  });
  advanceCursor();
  return {applied: true, seqJump};
};
