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

/**
 * Legal outbox lifecycle transitions; anything else throws.
 *
 * `conflicted → queued` is intentionally NOT listed here: the only legal way
 * out of `conflicted` is {@link Outbox.requeue}, which clones under a fresh
 * mutationId (the spent id is burned on the server's idempotency ledger).
 * Allowing `markQueued` from `conflicted` used to silently leave a `_conflicts`
 * row pointing at a now-queued mutation, and the next `keepMine` then threw
 * `Illegal outbox transition "queued" → "queued"`.
 */
const LEGAL_TRANSITIONS: Record<OutboxStatus, readonly OutboxStatus[]> = {
  acked: [],
  conflicted: [],
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
  maxAttempts: typeof row.maxAttempts === "number" ? row.maxAttempts : undefined,
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
  /** Per-mutation error-nack budget; omitted → engine default in replay. */
  maxAttempts?: number;
}

export interface RecoverStartupStateResult {
  /** mutationIds that were stranded `inFlight` and moved back to `queued`. */
  recoveredInFlight: string[];
  /** entityIds whose stale `pendingMutationId` was cleared (acked-with-pending). */
  releasedEntities: string[];
  /** mutationIds that were `conflicted` with no matching `_conflicts` row, now repaired. */
  repairedConflicts: string[];
  /**
   * entityIds whose `pendingMutationId` pointed at a mutation with no `_outbox`
   * row at all (pruned, wiped, or lost to a partial persist), now released.
   */
  clearedOrphanPendings: string[];
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
  /**
   * Repair helper: force a `queued`/`inFlight` row back to `conflicted` so
   * {@link Outbox.requeue} can run. Used when a `_conflicts` row outlived a
   * corrupt status transition (see resolveConflict keepMine).
   */
  restoreConflicted: (args: {mutationId: string}) => void;
  /**
   * Drop a spent outbox row. Used by `useServer` conflict resolution so the
   * abandoned conflicted mutation cannot be resurrected by
   * {@link Outbox.recoverStartupState} into a phantom `_conflicts` row.
   */
  discard: (args: {mutationId: string}) => void;
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
   * - Every entity whose `pendingMutationId` matches NO `_outbox` row (any
   *   user, any status) → clear the pending lock (Task 9.11b). Such an entity is
   *   frozen otherwise: the delta applier skips it for pending protection and
   *   repair refuses to overwrite it, so nothing can ever release it.
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
   * Per-collection counts for the requested statuses in a single table scan,
   * keyed by collection then status. Collections with no matching rows are
   * omitted, as are statuses with a zero count, so callers can treat a missing
   * key as 0.
   */
  countsByCollection: (args: {
    userId: string;
    statuses: readonly OutboxStatus[];
  }) => Record<string, Partial<Record<OutboxStatus, number>>>;
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
 * lifecycle (`queued → inFlight → acked|conflicted|failed`, `conflicted`
 * exits only via {@link Outbox.requeue} under a fresh mutationId, `inFlight →
 * queued` for transient retries) so replay behavior is deterministic across
 * restarts.
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
    if (args.maxAttempts !== undefined) {
      row.maxAttempts = args.maxAttempts;
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
    // Clone under a fresh id (reset attempt/error-nack counters, keep the original
    // FIFO position and per-mutation retry cap) and drop the spent row — its
    // mutationId is burned on the server's idempotency ledger.
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
    if (typeof row.maxAttempts === "number") {
      retryRow.maxAttempts = row.maxAttempts;
    }
    store.raw.setRow(OUTBOX_TABLE, retryId, retryRow as unknown as Row);
    store.raw.delRow(OUTBOX_TABLE, mutationId);
    return rowToMutation(retryId, retryRow);
  };

  /**
   * Repair helper for resolveConflict: if a `_conflicts` row still points at a
   * mutation that is no longer `conflicted` (corrupt `markQueued` from
   * conflicted, or a partial resolve), force it back to `conflicted` so
   * {@link requeue} can mint a fresh id. No-op when already conflicted.
   */
  const restoreConflicted = ({mutationId}: {mutationId: string}): void => {
    const row = requireRow(mutationId);
    const from = (row.status ?? "queued") as OutboxStatus;
    if (from === "conflicted") {
      return;
    }
    if (from !== "queued" && from !== "inFlight") {
      throw new Error(`Cannot restore conflicted status from "${from}" (mutation ${mutationId})`);
    }
    store.raw.setCell(OUTBOX_TABLE, mutationId, "status", "conflicted");
  };

  const discard = ({mutationId}: {mutationId: string}): void => {
    requireRow(mutationId);
    store.raw.delRow(OUTBOX_TABLE, mutationId);
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
      clearedOrphanPendings: [],
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

    // Orphan sweep (Task 9.11b). Runs after the row-driven passes above so an
    // acked-with-pending release is attributed to `releasedEntities` (its row
    // still exists here) rather than counted twice. A row belonging to another
    // user still counts as "matching": the store is wiped on a user switch, so a
    // surviving pointer means the mutation itself is genuinely still around.
    for (const pending of store.listPendingEntities()) {
      if (store.raw.hasRow(OUTBOX_TABLE, pending.pendingMutationId)) {
        continue;
      }
      const entity = store.getEntity({collection: pending.collection, id: pending.entityId});
      if (!entity) {
        continue;
      }
      store.upsertEntity({
        collection: pending.collection,
        data: entity.data,
        id: pending.entityId,
        pendingMutationId: "",
      });
      result.clearedOrphanPendings.push(pending.entityId);
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

  const countsByCollection = ({
    userId,
    statuses,
  }: {
    userId: string;
    statuses: readonly OutboxStatus[];
  }): Record<string, Partial<Record<OutboxStatus, number>>> => {
    const counts: Record<string, Partial<Record<OutboxStatus, number>>> = {};
    for (const row of Object.values(store.raw.getTable(OUTBOX_TABLE))) {
      const typedRow = row as Partial<OutboxRow>;
      if ((typedRow.userId ?? "") !== userId) {
        continue;
      }
      const status = (typedRow.status ?? "queued") as OutboxStatus;
      if (!statuses.includes(status)) {
        continue;
      }
      const collection = typedRow.collection ?? "";
      const forCollection = counts[collection] ?? {};
      forCollection[status] = (forCollection[status] ?? 0) + 1;
      counts[collection] = forCollection;
    }
    return counts;
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
    countsByCollection,
    discard,
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
    restoreConflicted,
  };
};
