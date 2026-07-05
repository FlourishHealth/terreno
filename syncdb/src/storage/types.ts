/**
 * Internal TinyBase table layout for the local-first store.
 *
 * Entity tables are named after their collection (e.g. "todos"); reserved
 * infrastructure tables are prefixed with "_" so they can never collide with a
 * collection name (collection names starting with "_" are rejected at store
 * creation). TinyBase cells only hold primitives (string | number | boolean),
 * so rich payloads are JSON-encoded into `data`/`args` cells; the `*Row`
 * interfaces below describe those primitive shapes, while the decoded,
 * application-facing shapes live in `../types`.
 */

import type {OutboxStatus, SyncMutationOperation} from "../types";

/** Reserved table holding durable outbox mutations; rowId = mutationId. */
export const OUTBOX_TABLE = "_outbox";

/** Reserved table holding per-stream sync cursors; rowId = stream key. */
export const CURSORS_TABLE = "_cursors";

/** Reserved table holding unresolved conflicts; rowId = mutationId. */
export const CONFLICTS_TABLE = "_conflicts";

/** Prefix marking reserved (non-collection) tables. */
export const RESERVED_TABLE_PREFIX = "_";

/** Primitive row shape for a `{collection}` entity table; rowId = entity id. */
export interface EntityRow {
  /** JSON-encoded entity payload. */
  data: string;
  /** Soft-delete tombstone flag. */
  deleted: boolean;
  /** Outbox mutation currently protecting this entity's optimistic state ("" = none). */
  pendingMutationId: string;
  /** Highest server seq applied to this entity (0 = local-only, never synced). */
  seq: number;
}

/** Primitive row shape for the `_outbox` table; rowId = mutationId. */
export interface OutboxRow {
  /** JSON-encoded mutation args. */
  args: string;
  attemptCount: number;
  /** Absent when the mutation carries no base version (e.g. creates). */
  baseVersion?: number;
  collection: string;
  createdAt: string;
  /** Monotonic insertion counter; FIFO tiebreaker when createdAt collides. */
  enqueueOrder: number;
  entityId: string;
  operation: SyncMutationOperation;
  status: OutboxStatus;
  userId: string;
}

/** Primitive row shape for the `_cursors` table; rowId = stream key. */
export interface CursorRow {
  /** Highest seq applied for the stream. */
  seq: number;
  updatedAt: string;
}

/** Primitive row shape for the `_conflicts` table; rowId = mutationId. */
export interface ConflictRow {
  collection: string;
  dismissed: boolean;
  entityId: string;
  /** JSON-encoded local (optimistic) entity data. */
  localData: string;
  /** JSON-encoded canonical server entity data. */
  serverData: string;
  serverSeq: number;
}

/** Decoded, application-facing entity record returned by store accessors. */
export interface SyncEntity<TData = unknown> {
  /** Decoded entity payload. */
  data: TData;
  /** Soft-delete tombstone flag. */
  deleted: boolean;
  /** Entity id (the TinyBase row id). */
  id: string;
  /** Outbox mutation currently protecting this entity, if any. */
  pendingMutationId?: string;
  /** Highest server seq applied to this entity (0 = local-only). */
  seq: number;
}
