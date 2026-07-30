import {DateTime} from "luxon";

import type {SyncStore} from "../storage/store";
import {CURSORS_TABLE, type CursorRow} from "../storage/types";

const defaultNow = (): string => DateTime.now().toISO();

/**
 * Highest seq applied for a stream. Streams that have never synced report 0,
 * which keeps the seq-jump arithmetic (`seq > cursor + 1`) uniform.
 */
export const getCursor = ({store, stream}: {store: SyncStore; stream: string}): number => {
  const seq = store.raw.getCell(CURSORS_TABLE, stream, "seq");
  return typeof seq === "number" ? seq : 0;
};

/**
 * Advance a stream's cursor. Cursors are monotonic: a seq at or below the
 * current cursor is ignored, so out-of-order or duplicate deltas can never
 * rewind catch-up state.
 *
 * Writes cell-by-cell rather than replacing the row: the same row also carries
 * the snapshot-progress cells below, which a delta-driven advance must never
 * clear.
 */
export const setCursor = ({
  store,
  stream,
  seq,
  now = defaultNow,
}: {
  store: SyncStore;
  stream: string;
  seq: number;
  now?: () => string;
}): void => {
  if (seq <= getCursor({store, stream})) {
    return;
  }
  store.raw.transaction(() => {
    store.raw.setCell(CURSORS_TABLE, stream, "seq", seq);
    store.raw.setCell(CURSORS_TABLE, stream, "updatedAt", now());
  });
};

/**
 * Highest seq this client has actually PAGED THROUGH the snapshot endpoint for a
 * stream — snapshot bootstrap progress, tracked separately from the applied-seq
 * cursor above.
 *
 * The two must not be conflated. `seq` advances on every delta the socket
 * delivers, including one at seq 9000 that lands while bootstrap has only paged
 * up to seq 200. Resuming an interrupted bootstrap from that cursor would skip
 * seqs 201..8999 forever: those entities were never in a snapshot page and
 * their deltas were never delivered, yet no later reconcile would ever ask for
 * them again (the cursor already sits at the stream head). This cell is the
 * resume point that only bootstrap itself moves.
 */
export const getSnapshotCursor = ({store, stream}: {store: SyncStore; stream: string}): number => {
  const seq = store.raw.getCell(CURSORS_TABLE, stream, "snapshotSeq");
  return typeof seq === "number" ? seq : 0;
};

/** Advance snapshot bootstrap progress for a stream (monotonic, like {@link setCursor}). */
export const setSnapshotCursor = ({
  store,
  stream,
  seq,
}: {
  store: SyncStore;
  stream: string;
  seq: number;
}): void => {
  if (seq <= getSnapshotCursor({store, stream})) {
    return;
  }
  store.raw.setCell(CURSORS_TABLE, stream, "snapshotSeq", seq);
};

/**
 * True once a snapshot pass has reached the stream's head (the server reported
 * `hasMore: false`). From then on the stream is fully materialized locally, so
 * catch-up resumes from the applied-seq cursor — deltas carry their own data,
 * so there is nothing below it left to page.
 */
export const isStreamBootstrapped = ({
  store,
  stream,
}: {
  store: SyncStore;
  stream: string;
}): boolean => store.raw.getCell(CURSORS_TABLE, stream, "bootstrapped") === true;

/** Record that a snapshot pass reached the stream's head. */
export const markStreamBootstrapped = ({
  store,
  stream,
}: {
  store: SyncStore;
  stream: string;
}): void => {
  store.raw.setCell(CURSORS_TABLE, stream, "bootstrapped", true);
};

/** All known stream cursors (stream key → highest applied seq). */
export const getAllCursors = ({store}: {store: SyncStore}): Record<string, number> => {
  const cursors: Record<string, number> = {};
  for (const [stream, row] of Object.entries(store.raw.getTable(CURSORS_TABLE))) {
    const seq = (row as Partial<CursorRow>).seq;
    cursors[stream] = typeof seq === "number" ? seq : 0;
  }
  return cursors;
};
