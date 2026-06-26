import {DateTime} from "luxon";
import type {MergeableStore, Row} from "tinybase";

import {
  type OutboxMutation,
  type OutboxOperation,
  type OutboxRow,
  type OutboxStatus,
  SYNC_TABLES,
} from "../storage/types";

const nowIso = (): string => DateTime.utc().toISO();

const generateId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `mut_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const encodeArgs = (args: unknown): string => JSON.stringify(args ?? {});

const decodeArgs = <TArgs>(raw: string | undefined): TArgs => {
  if (!raw) {
    return {} as TArgs;
  }
  return JSON.parse(raw) as TArgs;
};

const rowToMutation = <TArgs>(
  mutationId: string,
  row: Partial<OutboxRow>
): OutboxMutation<TArgs> => ({
  args: decodeArgs<TArgs>(row.args),
  attemptCount: row.attemptCount ?? 0,
  baseVersion: row.baseVersion ? row.baseVersion : undefined,
  collection: row.collection ?? "",
  createdAt: row.createdAt ?? "",
  entityId: row.entityId ? row.entityId : undefined,
  lastAttemptAt: row.lastAttemptAt ? row.lastAttemptAt : undefined,
  mutationId,
  operation: (row.operation ?? "update") as OutboxOperation,
  status: (row.status ?? "queued") as OutboxStatus,
  userId: row.userId ? row.userId : undefined,
});

export interface EnqueueArgs<TArgs> {
  collection: string;
  operation: OutboxOperation;
  args: TArgs;
  entityId?: string;
  baseVersion?: string;
  userId?: string;
  /** Optional explicit id (defaults to a generated UUID; useful in tests). */
  mutationId?: string;
  /** Optional explicit ISO creation timestamp (defaults to now). */
  createdAt?: string;
}

export interface Outbox {
  enqueue<TArgs>(args: EnqueueArgs<TArgs>): OutboxMutation<TArgs>;
  get<TArgs>(args: {mutationId: string}): OutboxMutation<TArgs> | undefined;
  list<TArgs>(args?: {status?: OutboxStatus}): OutboxMutation<TArgs>[];
  count(args?: {status?: OutboxStatus}): number;
  markInFlight(args: {mutationId: string}): void;
  markAcked(args: {mutationId: string}): void;
  markConflicted(args: {mutationId: string}): void;
  markFailed(args: {mutationId: string}): void;
  requeue(args: {mutationId: string}): void;
  remove(args: {mutationId: string}): void;
  clear(): void;
  clearForOtherUsers(args: {currentUserId: string}): void;
}

/**
 * Durable outbox state machine backed by the TinyBase store. Enforces valid
 * lifecycle transitions (`queued -> inFlight -> acked/conflicted/failed`, with
 * `conflicted/failed -> queued` requeues) so replay behavior is deterministic.
 */
export const createOutbox = ({store}: {store: MergeableStore}): Outbox => {
  const requireRow = (mutationId: string): Partial<OutboxRow> => {
    if (!store.hasRow(SYNC_TABLES.outbox, mutationId)) {
      throw new Error(`Outbox mutation not found: ${mutationId}`);
    }
    return store.getRow(SYNC_TABLES.outbox, mutationId) as Partial<OutboxRow>;
  };

  const enqueue = <TArgs>(args: EnqueueArgs<TArgs>): OutboxMutation<TArgs> => {
    const mutationId = args.mutationId ?? generateId();
    const row: OutboxRow = {
      args: encodeArgs(args.args),
      attemptCount: 0,
      baseVersion: args.baseVersion ?? "",
      collection: args.collection,
      createdAt: args.createdAt ?? nowIso(),
      entityId: args.entityId ?? "",
      lastAttemptAt: "",
      operation: args.operation,
      status: "queued",
      userId: args.userId ?? "",
    };
    store.setRow(SYNC_TABLES.outbox, mutationId, row as unknown as Row);
    return rowToMutation<TArgs>(mutationId, row);
  };

  const get = <TArgs>({mutationId}: {mutationId: string}): OutboxMutation<TArgs> | undefined => {
    if (!store.hasRow(SYNC_TABLES.outbox, mutationId)) {
      return undefined;
    }
    return rowToMutation<TArgs>(
      mutationId,
      store.getRow(SYNC_TABLES.outbox, mutationId) as Partial<OutboxRow>
    );
  };

  const list = <TArgs>({status}: {status?: OutboxStatus} = {}): OutboxMutation<TArgs>[] => {
    const table = store.getTable(SYNC_TABLES.outbox);
    const mutations: OutboxMutation<TArgs>[] = [];
    for (const [mutationId, row] of Object.entries(table)) {
      const mutation = rowToMutation<TArgs>(mutationId, row as Partial<OutboxRow>);
      if (status && mutation.status !== status) {
        continue;
      }
      mutations.push(mutation);
    }
    mutations.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return mutations;
  };

  const count = ({status}: {status?: OutboxStatus} = {}): number => list({status}).length;

  const markInFlight = ({mutationId}: {mutationId: string}): void => {
    const row = requireRow(mutationId);
    if (row.status !== "queued") {
      throw new Error(`Cannot mark in flight from status "${row.status}" (mutation ${mutationId})`);
    }
    store.setCell(SYNC_TABLES.outbox, mutationId, "status", "inFlight");
    store.setCell(SYNC_TABLES.outbox, mutationId, "attemptCount", (row.attemptCount ?? 0) + 1);
    store.setCell(SYNC_TABLES.outbox, mutationId, "lastAttemptAt", nowIso());
  };

  const markAcked = ({mutationId}: {mutationId: string}): void => {
    requireRow(mutationId);
    store.delRow(SYNC_TABLES.outbox, mutationId);
  };

  const markConflicted = ({mutationId}: {mutationId: string}): void => {
    const row = requireRow(mutationId);
    if (row.status !== "inFlight") {
      throw new Error(
        `Cannot mark conflicted from status "${row.status}" (mutation ${mutationId})`
      );
    }
    store.setCell(SYNC_TABLES.outbox, mutationId, "status", "conflicted");
  };

  const markFailed = ({mutationId}: {mutationId: string}): void => {
    const row = requireRow(mutationId);
    if (row.status !== "inFlight") {
      throw new Error(`Cannot mark failed from status "${row.status}" (mutation ${mutationId})`);
    }
    store.setCell(SYNC_TABLES.outbox, mutationId, "status", "failed");
  };

  const requeue = ({mutationId}: {mutationId: string}): void => {
    const row = requireRow(mutationId);
    if (row.status !== "conflicted" && row.status !== "failed") {
      throw new Error(`Cannot requeue from status "${row.status}" (mutation ${mutationId})`);
    }
    store.setCell(SYNC_TABLES.outbox, mutationId, "status", "queued");
  };

  const remove = ({mutationId}: {mutationId: string}): void => {
    store.delRow(SYNC_TABLES.outbox, mutationId);
  };

  const clear = (): void => {
    store.delTable(SYNC_TABLES.outbox);
  };

  const clearForOtherUsers = ({currentUserId}: {currentUserId: string}): void => {
    const table = store.getTable(SYNC_TABLES.outbox);
    for (const [mutationId, row] of Object.entries(table)) {
      const userId = (row as Partial<OutboxRow>).userId ?? "";
      if (userId !== currentUserId) {
        store.delRow(SYNC_TABLES.outbox, mutationId);
      }
    }
  };

  return {
    clear,
    clearForOtherUsers,
    count,
    enqueue,
    get,
    list,
    markAcked,
    markConflicted,
    markFailed,
    markInFlight,
    remove,
    requeue,
  };
};
