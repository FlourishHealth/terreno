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
  const row: CursorRow = {seq, updatedAt: now()};
  store.raw.setRow(CURSORS_TABLE, stream, {...row});
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
