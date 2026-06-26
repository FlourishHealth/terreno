import {DateTime} from "luxon";

import type {SyncStore} from "../storage/store";
import {SYNC_TABLES} from "../storage/types";
import type {DeltaChange, SyncDeltaEvent} from "./types";

const nowIso = (): string => DateTime.utc().toISO();

/** True when cursor `a` is strictly after cursor `b` (numeric when possible). */
const isAfter = (a: string, b: string): boolean => {
  const numA = Number(a);
  const numB = Number(b);
  if (Number.isFinite(numA) && Number.isFinite(numB)) {
    return numA > numB;
  }
  return a.localeCompare(b) > 0;
};

export interface DeltaApplyResult {
  /** True when the whole delta was skipped (duplicate/out-of-order cursor). */
  skipped: boolean;
  /** Number of individual changes actually written. */
  applied: number;
  /** The stream cursor after processing. */
  cursor: string;
}

export interface DeltaApplier {
  apply(event: SyncDeltaEvent): DeltaApplyResult;
  getCursor(args: {stream: string}): string | undefined;
}

/**
 * Apply server deltas to the local store with monotonic-cursor and per-entity
 * version idempotency. Deltas at or before the stored cursor are skipped whole;
 * within an accepted delta, a change whose version already matches the local
 * entity is skipped to avoid clobbering newer local data.
 */
export const createDeltaApplier = ({store}: {store: SyncStore}): DeltaApplier => {
  const getCursor = ({stream}: {stream: string}): string | undefined => {
    if (!store.raw.hasRow(SYNC_TABLES.cursors, stream)) {
      return undefined;
    }
    const cursor = store.raw.getCell(SYNC_TABLES.cursors, stream, "cursor");
    return typeof cursor === "string" ? cursor : undefined;
  };

  const setCursor = ({stream, cursor}: {stream: string; cursor: string}): void => {
    store.raw.setRow(SYNC_TABLES.cursors, stream, {cursor, stream, updatedAt: nowIso()});
  };

  const applyChange = (change: DeltaChange): boolean => {
    const existing = store.getEntity({collection: change.collection, id: change.entityId});

    if (change.op === "delete") {
      store.deleteEntity({collection: change.collection, id: change.entityId});
      return existing !== undefined && !existing.deleted;
    }

    if (existing && change.version && existing.version === change.version) {
      return false;
    }

    store.upsertEntity({
      collection: change.collection,
      data: change.data ?? {},
      id: change.entityId,
      updatedAt: change.updatedAt,
      version: change.version,
    });
    return true;
  };

  const apply = (event: SyncDeltaEvent): DeltaApplyResult => {
    const current = getCursor({stream: event.stream});
    if (current !== undefined && !isAfter(event.cursor, current)) {
      return {applied: 0, cursor: current, skipped: true};
    }

    let applied = 0;
    for (const change of event.changes) {
      if (applyChange(change)) {
        applied += 1;
      }
    }
    setCursor({cursor: event.cursor, stream: event.stream});
    return {applied, cursor: event.cursor, skipped: false};
  };

  return {apply, getCursor};
};
