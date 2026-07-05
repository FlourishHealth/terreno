import {DateTime} from "luxon";
import type {Row} from "tinybase";

import type {SyncStore} from "../storage/store";
import {OUTBOX_TABLE, type OutboxRow} from "../storage/types";
import type {OutboxMutation, OutboxStatus, SyncMutationOperation} from "../types";

const defaultNow = (): string => DateTime.now().toISO();

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

export interface Outbox {
  enqueue: (args: EnqueueArgs) => OutboxMutation;
  getMutation: (args: {mutationId: string}) => OutboxMutation | undefined;
  /** Queued mutations for a user, FIFO by createdAt then insertion order. */
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
  /** conflicted → queued with a fresh baseVersion (keepMine resolution). */
  requeue: (args: {mutationId: string; baseVersion?: number}) => void;
  /** Remove every mutation belonging to the given user (wipe-on-user-change). */
  clearForUser: (args: {userId: string}) => void;
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

  const nextEnqueueOrder = (): number => {
    let max = 0;
    for (const row of Object.values(store.raw.getTable(OUTBOX_TABLE))) {
      const order = (row as Partial<OutboxRow>).enqueueOrder ?? 0;
      if (order > max) {
        max = order;
      }
    }
    return max + 1;
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
    entries.sort(
      (a, b) => a.mutation.createdAt.localeCompare(b.mutation.createdAt) || a.order - b.order
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

  const markAcked = ({mutationId}: {mutationId: string}): void => {
    transition(mutationId, "acked");
  };

  const markConflicted = ({mutationId}: {mutationId: string}): void => {
    transition(mutationId, "conflicted");
  };

  const markFailed = ({mutationId}: {mutationId: string}): void => {
    transition(mutationId, "failed");
  };

  const requeue = ({mutationId, baseVersion}: {mutationId: string; baseVersion?: number}): void => {
    const row = requireRow(mutationId);
    const from = (row.status ?? "queued") as OutboxStatus;
    if (from !== "conflicted") {
      throw new Error(`Illegal outbox transition "${from}" → "queued" (mutation ${mutationId})`);
    }
    store.raw.setCell(OUTBOX_TABLE, mutationId, "status", "queued");
    if (baseVersion !== undefined) {
      store.raw.setCell(OUTBOX_TABLE, mutationId, "baseVersion", baseVersion);
    }
  };

  const clearForUser = ({userId}: {userId: string}): void => {
    const table = store.raw.getTable(OUTBOX_TABLE);
    for (const [mutationId, row] of Object.entries(table)) {
      if (((row as Partial<OutboxRow>).userId ?? "") === userId) {
        store.raw.delRow(OUTBOX_TABLE, mutationId);
      }
    }
  };

  return {
    clearForUser,
    enqueue,
    getMutation,
    listQueued,
    markAcked,
    markConflicted,
    markFailed,
    markInFlight,
    markQueued,
    requeue,
  };
};
