import {DateTime} from "luxon";
import type {Row} from "tinybase";

import type {SyncStore} from "../storage/store";
import {CONFLICTS_TABLE, OUTBOX_TABLE, type OutboxRow} from "../storage/types";
import type {OutboxMutation, OutboxStatus, SyncMutationOperation} from "../types";

const defaultNow = (): string => DateTime.now().toISO();

/** Default number of failed rows retained by `prune()` for debugging/UI. */
export const DEFAULT_KEEP_FAILED = 50;

/** Generate a stable client mutation id (idempotency key). */
export const generateMutationId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `mut_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

/** Legal outbox lifecycle transitions; anything else throws. */
const LEGAL_TRANSITIONS: Record<OutboxStatus, readonly OutboxStatus[]> = {
  acked: [],
  conflicted: ["queued"],
  failed: [],
  inFlight: ["acked", "conflicted", "failed", "queued"],
  queued: ["inFlight"],
};

const rowToMutation = (mutationId: string, row: Partial<OutboxRow>): OutboxMutation => ({
  args: row.args ?? "{}",
  attemptCount: row.attemptCount ?? 0,
  baseVersion: typeof row.baseVersion === "number" ? row.baseVersion : undefined,
  collection: row.collection ?? "",
  createdAt: row.createdAt ?? "",
  entityId: row.entityId ?? "",
  errorNackCount: row.errorNackCount ?? 0,
  mutationId,
  operation: (row.operation ?? "update") as SyncMutationOperation,
  status: (row.status ?? "queued") as OutboxStatus,
  userId: row.userId ?? "",
});

export interface EnqueueArgs {
  collection: string;
  operation: SyncMutationOperation;
  entityId: string;
  /** Mutation arguments; JSON-serialized into the row. */
  args: Record<string, unknown>;
  /** The seq the client last saw for the entity (LWW conflict detection). */
  baseVersion?: number;
  /** The user this mutation belongs to; replay skips mutations from other users. */
  userId: string;
  /** Optional explicit id (defaults to a generated UUID; useful in tests). */
  mutationId?: string;
}

export interface RecoverStartupStateResult {
  /** mutationIds that were stranded `inFlight` and moved back to `queued`. */
  recoveredInFlight: string[];
  /** entityIds whose stale `pendingMutationId` was cleared (acked-with-pending). */
  releasedEntities: string[];
  /** mutationIds that were `conflicted` with no matching `_conflicts` row, now repaired. */
  repairedConflicts: string[];
}

export interface Outbox {
  enqueue: (args: EnqueueArgs) => OutboxMutation;
  getMutation: (args: {mutationId: string}) => OutboxMutation | undefined;
  /** Queued mutations for a user, global FIFO by enqueueOrder (createdAt tiebreak). */
  listQueued: (args: {collection?: string; userId: string}) => OutboxMutation[];
  /** queued → inFlight; increments attemptCount. */
  markInFlight: (args: {mutationId: string}) => void;
  /** inFlight → queued (retry after a transient transport error). */
  markQueued: (args: {mutationId: string}) => void;
  /** inFlight → acked (server accepted the mutation). */
  markAcked: (args: {mutationId: string}) => void;
  /** inFlight → conflicted (server nacked with a conflict). */
  markConflicted: (args: {mutationId: string}) => void;
  /** inFlight → failed (terminal, non-retryable rejection). */
  markFailed: (args: {mutationId: string}) => void;
  /**
   * inFlight → queued after a server error-nack; increments the dedicated
   * `errorNackCount` retry-budget cell (NOT `attemptCount`, which stays a
   * diagnostic total across every send attempt including transport failures).
   */
  markQueuedAfterErrorNack: (args: {mutationId: string}) => void;
  /**
   * Re-enqueue a conflicted mutation under a FRESH mutationId with the given
   * baseVersion (keepMine resolution). The server's idempotency ledger records
   * a terminal outcome per mutationId, so retrying with the original id would
   * only ever read back the recorded conflict nack — the retry is a new
   * mutation and must carry a new id. Returns the re-enqueued mutation.
   */
  requeue: (args: {mutationId: string; baseVersion?: number}) => OutboxMutation;
  /** Remove every mutation belonging to the given user (wipe-on-user-change). */
  clearForUser: (args: {userId: string}) => void;
  /**
   * Startup crash recovery (A1): repair rows stranded by a crash mid-lifecycle.
   * Must run once at client start, before the first replay.
   *
   * - Every `inFlight` row for the user → back to `queued` (NOT an attempt —
   *   attemptCount/errorNackCount are untouched).
   * - Every `acked` row for the user whose entity still has
   *   `pendingMutationId === mutationId` → clear the entity's
   *   `pendingMutationId` (replays the missing `releaseEntity`).
   * - Every `conflicted` row for the user with no matching `_conflicts` row →
   *   write the conflict row now (localData from the entity, serverData null,
   *   serverSeq 0) so the UI can surface it.
   */
  recoverStartupState: (args: {userId: string}) => RecoverStartupStateResult;
  /**
   * Delete `acked` rows (no future value once acked — the server ledger owns
   * idempotency) and trim `failed` rows to the most recent `keepFailed`
   * (default {@link DEFAULT_KEEP_FAILED}). `conflicted` rows are never pruned
   * automatically. Call after each successful drain pass.
   */
  prune: (args: {userId: string; keepFailed?: number}) => void;
  /** Count of the user's mutations currently in the given status. */
  countByStatus: (args: {userId: string; status: OutboxStatus}) => number;
  /**
   * True when ANY outbox row (any status — queued, inFlight, conflicted, or
   * failed) still exists for the given user/collection/entity. Used by the
   * replay coordinator's FIX 4 GC to distinguish "the entity's failed row was
   * pruned with nothing queued behind it" (block should be dropped) from "a
   * successor is queued but the failed row itself was already pruned" (block
   * must still hold) — checking queued-only would wrongly treat the latter
   * as already-cleared during the narrow window between a validation failure
   * and its successor's enqueue.
   */
  hasAnyRowForEntity: (args: {userId: string; collection: string; entityId: string}) => boolean;
}

/**
 * Durable outbox state machine over the `_outbox` table. Enforces the legal
 * lifecycle (`queued → inFlight → acked|conflicted|failed`, `conflicted →
 * queued` via requeue, `inFlight → queued` for transient retries) so replay
 * behavior is deterministic across restarts.
 */
export const createOutbox = ({
  store,
  now = defaultNow,
}: {
  store: SyncStore;
  now?: () => string;
}): Outbox => {
  const requireRow = (mutationId: string): Partial<OutboxRow> => {
    if (!store.raw.hasRow(OUTBOX_TABLE, mutationId)) {
      throw new Error(`Outbox mutation not found: ${mutationId}`);
    }
    return store.raw.getRow(OUTBOX_TABLE, mutationId) as Partial<OutboxRow>;
  };

  const transition = (mutationId: string, to: OutboxStatus): Partial<OutboxRow> => {
    const row = requireRow(mutationId);
    const from = (row.status ?? "queued") as OutboxStatus;
    if (!LEGAL_TRANSITIONS[from].includes(to)) {
      throw new Error(`Illegal outbox transition "${from}" → "${to}" (mutation ${mutationId})`);
    }
    store.raw.setCell(OUTBOX_TABLE, mutationId, "status", to);
    return row;
  };

  /**
   * O(1) FIFO ordering: the max enqueueOrder is cached in a `_meta` value cell
   * (`outboxMaxEnqueueOrder`) so enqueue never scans the whole table. TinyBase's
   * ValuesSchema always supplies a default of 0 for an unset cell, so "absent"
   * is indistinguishable from "genuinely zero" at the storage layer — treat a
   * cached 0 as unknown and rebuild once from a table scan (covers both a
   * fresh store, where the scan is a cheap no-op, and a store persisted before
   * this cell existed, where the scan recovers the true max). Once the cache
   * is non-zero it is trusted from then on.
   */
  const nextEnqueueOrder = (): number => {
    const cached = store.raw.getValue("outboxMaxEnqueueOrder");
    let max = typeof cached === "number" && cached > 0 ? cached : undefined;
    if (max === undefined) {
      max = 0;
      for (const row of Object.values(store.raw.getTable(OUTBOX_TABLE))) {
        const order = (row as Partial<OutboxRow>).enqueueOrder ?? 0;
        if (order > max) {
          max = order;
        }
      }
    }
    const next = max + 1;
    store.raw.setValue("outboxMaxEnqueueOrder", next);
    return next;
  };

  const enqueue = (args: EnqueueArgs): OutboxMutation => {
    const mutationId = args.mutationId ?? generateMutationId();
    const row: OutboxRow = {
      args: JSON.stringify(args.args ?? {}),
      attemptCount: 0,
      collection: args.collection,
      createdAt: now(),
      enqueueOrder: nextEnqueueOrder(),
      entityId: args.entityId,
      errorNackCount: 0,
      operation: args.operation,
      status: "queued",
      userId: args.userId,
    };
    if (args.baseVersion !== undefined) {
      row.baseVersion = args.baseVersion;
    }
    store.raw.setRow(OUTBOX_TABLE, mutationId, row as unknown as Row);
    return rowToMutation(mutationId, row);
  };

  const getMutation = ({mutationId}: {mutationId: string}): OutboxMutation | undefined => {
    if (!store.raw.hasRow(OUTBOX_TABLE, mutationId)) {
      return undefined;
    }
    return rowToMutation(
      mutationId,
      store.raw.getRow(OUTBOX_TABLE, mutationId) as Partial<OutboxRow>
    );
  };

  const listQueued = ({
    collection,
    userId,
  }: {
    collection?: string;
    userId: string;
  }): OutboxMutation[] => {
    const table = store.raw.getTable(OUTBOX_TABLE);
    const entries: {mutation: OutboxMutation; order: number}[] = [];
    for (const [mutationId, row] of Object.entries(table)) {
      const typedRow = row as Partial<OutboxRow>;
      if (typedRow.status !== "queued") {
        continue;
      }
      if ((typedRow.userId ?? "") !== userId) {
        continue;
      }
      if (collection !== undefined && typedRow.collection !== collection) {
        continue;
      }
      entries.push({
        mutation: rowToMutation(mutationId, typedRow),
        order: typedRow.enqueueOrder ?? 0,
      });
    }
    // enqueueOrder is the durable FIFO key (a monotonic integer, immune to
    // locale/timezone drift); createdAt is only a tiebreak for legacy rows
    // that predate the cell (order defaults to 0).
    entries.sort(
      (a, b) => a.order - b.order || a.mutation.createdAt.localeCompare(b.mutation.createdAt)
    );
    return entries.map((entry) => entry.mutation);
  };

  const markInFlight = ({mutationId}: {mutationId: string}): void => {
    const row = transition(mutationId, "inFlight");
    store.raw.setCell(OUTBOX_TABLE, mutationId, "attemptCount", (row.attemptCount ?? 0) + 1);
  };

  const markQueued = ({mutationId}: {mutationId: string}): void => {
    transition(mutationId, "queued");
  };

  const markQueuedAfterErrorNack = ({mutationId}: {mutationId: string}): void => {
    const row = transition(mutationId, "queued");
    store.raw.setCell(OUTBOX_TABLE, mutationId, "errorNackCount", (row.errorNackCount ?? 0) + 1);
  };

  const markAcked = ({mutationId}: {mutationId: string}): void => {
    transition(mutationId, "acked");
  };

  const markConflicted = ({mutationId}: {mutationId: string}): void => {
    transition(mutationId, "conflicted");
  };

  const markFailed = ({mutationId}: {mutationId: string}): void => {
    transition(mutationId, "failed");
  };

  const requeue = ({
    mutationId,
    baseVersion,
  }: {
    mutationId: string;
    baseVersion?: number;
  }): OutboxMutation => {
    const row = requireRow(mutationId);
    const from = (row.status ?? "queued") as OutboxStatus;
    if (from !== "conflicted") {
      throw new Error(`Illegal outbox transition "${from}" → "queued" (mutation ${mutationId})`);
    }
    // Clone under a fresh id (fresh retry budget, original FIFO position) and drop the
    // spent row — its mutationId is burned on the server's idempotency ledger.
    const retryId = generateMutationId();
    const retryRow: OutboxRow = {
      args: row.args ?? "{}",
      attemptCount: 0,
      collection: row.collection ?? "",
      createdAt: row.createdAt ?? now(),
      enqueueOrder: row.enqueueOrder ?? 0,
      entityId: row.entityId ?? "",
      errorNackCount: 0,
      operation: row.operation ?? "update",
      status: "queued",
      userId: row.userId ?? "",
    };
    const retryBaseVersion = baseVersion ?? row.baseVersion;
    if (retryBaseVersion !== undefined) {
      retryRow.baseVersion = retryBaseVersion;
    }
    store.raw.setRow(OUTBOX_TABLE, retryId, retryRow as unknown as Row);
    store.raw.delRow(OUTBOX_TABLE, mutationId);
    return rowToMutation(retryId, retryRow);
  };

  const clearForUser = ({userId}: {userId: string}): void => {
    const table = store.raw.getTable(OUTBOX_TABLE);
    for (const [mutationId, row] of Object.entries(table)) {
      if (((row as Partial<OutboxRow>).userId ?? "") === userId) {
        store.raw.delRow(OUTBOX_TABLE, mutationId);
      }
    }
  };

  const recoverStartupState = ({userId}: {userId: string}): RecoverStartupStateResult => {
    const result: RecoverStartupStateResult = {
      recoveredInFlight: [],
      releasedEntities: [],
      repairedConflicts: [],
    };
    const table = store.raw.getTable(OUTBOX_TABLE);
    for (const [mutationId, row] of Object.entries(table)) {
      const typedRow = row as Partial<OutboxRow>;
      if ((typedRow.userId ?? "") !== userId) {
        continue;
      }

      if (typedRow.status === "inFlight") {
        // Recovery is not an attempt: transition directly, bypassing
        // markQueued's semantics (which is reserved for post-send retries).
        store.raw.setCell(OUTBOX_TABLE, mutationId, "status", "queued");
        result.recoveredInFlight.push(mutationId);
        continue;
      }

      if (typedRow.status === "acked") {
        const collection = typedRow.collection ?? "";
        const entityId = typedRow.entityId ?? "";
        if (!collection || !entityId) {
          continue;
        }
        const entity = store.getEntity({collection, id: entityId});
        if (entity?.pendingMutationId === mutationId) {
          store.upsertEntity({
            collection,
            data: entity.data,
            id: entityId,
            pendingMutationId: "",
          });
          result.releasedEntities.push(entityId);
        }
        continue;
      }

      if (typedRow.status === "conflicted") {
        if (store.raw.hasRow(CONFLICTS_TABLE, mutationId)) {
          continue;
        }
        const collection = typedRow.collection ?? "";
        const entityId = typedRow.entityId ?? "";
        const entity = store.getEntity({collection, id: entityId});
        store.raw.setRow(CONFLICTS_TABLE, mutationId, {
          collection,
          dismissed: false,
          entityId,
          localData: JSON.stringify(entity?.data ?? null),
          serverData: JSON.stringify(null),
          serverSeq: 0,
        });
        result.repairedConflicts.push(mutationId);
      }
    }
    return result;
  };

  const prune = ({
    userId,
    keepFailed = DEFAULT_KEEP_FAILED,
  }: {
    userId: string;
    keepFailed?: number;
  }): void => {
    const table = store.raw.getTable(OUTBOX_TABLE);
    const failedRows: {mutationId: string; order: number}[] = [];
    for (const [mutationId, row] of Object.entries(table)) {
      const typedRow = row as Partial<OutboxRow>;
      if ((typedRow.userId ?? "") !== userId) {
        continue;
      }
      if (typedRow.status === "acked") {
        store.raw.delRow(OUTBOX_TABLE, mutationId);
        continue;
      }
      if (typedRow.status === "failed") {
        failedRows.push({mutationId, order: typedRow.enqueueOrder ?? 0});
      }
    }
    if (failedRows.length <= keepFailed) {
      return;
    }
    // Keep the most recent `keepFailed` (highest enqueueOrder); delete the rest.
    failedRows.sort((a, b) => b.order - a.order);
    for (const {mutationId} of failedRows.slice(keepFailed)) {
      store.raw.delRow(OUTBOX_TABLE, mutationId);
    }
  };

  const countByStatus = ({userId, status}: {userId: string; status: OutboxStatus}): number => {
    let count = 0;
    for (const row of Object.values(store.raw.getTable(OUTBOX_TABLE))) {
      const typedRow = row as Partial<OutboxRow>;
      if ((typedRow.userId ?? "") === userId && typedRow.status === status) {
        count += 1;
      }
    }
    return count;
  };

  const hasAnyRowForEntity = ({
    userId,
    collection,
    entityId,
  }: {
    userId: string;
    collection: string;
    entityId: string;
  }): boolean => {
    for (const row of Object.values(store.raw.getTable(OUTBOX_TABLE))) {
      const typedRow = row as Partial<OutboxRow>;
      if (
        (typedRow.userId ?? "") === userId &&
        typedRow.collection === collection &&
        typedRow.entityId === entityId
      ) {
        return true;
      }
    }
    return false;
  };

  return {
    clearForUser,
    countByStatus,
    enqueue,
    getMutation,
    hasAnyRowForEntity,
    listQueued,
    markAcked,
    markConflicted,
    markFailed,
    markInFlight,
    markQueued,
    markQueuedAfterErrorNack,
    prune,
    recoverStartupState,
    requeue,
  };
};
