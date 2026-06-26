/**
 * Canonical local storage contracts for the syncdb local-first data layer.
 *
 * The runtime persistence engine is TinyBase, whose cells only hold primitive
 * values (string | number | boolean). Rich payloads are therefore serialized to
 * JSON strings on the way into the store and decoded on the way out. The
 * interfaces below describe the decoded, application-facing shapes; the `*Row`
 * interfaces describe the primitive shapes actually stored in TinyBase.
 */

/** Logical TinyBase table identifiers used by the local store. */
export const SYNC_TABLES = {
  conflicts: "conflicts",
  cursors: "cursors",
  entities: "entities",
  outbox: "outbox",
} as const;

export type SyncTableId = (typeof SYNC_TABLES)[keyof typeof SYNC_TABLES];

/** Operations a local mutation can represent (mirrors @terreno/api array ops). */
export type OutboxOperation =
  | "create"
  | "update"
  | "delete"
  | "arrayPush"
  | "arrayUpdate"
  | "arrayRemove";

/** Lifecycle states for a durable outbox mutation. */
export type OutboxStatus = "queued" | "inFlight" | "acked" | "conflicted" | "failed";

/** Decoded, application-facing entity record. */
export interface LocalEntityRecord<TData = Record<string, unknown>> {
  /** Composite key, `${collection}:${id}`, used as the TinyBase row id. */
  key: string;
  /** Logical collection/resource name, e.g. "todos". */
  collection: string;
  /** Server (or locally-minted) entity id. */
  id: string;
  /** Decoded entity payload. */
  data: TData;
  /** ISO timestamp of the last known update (server or local). */
  updatedAt: string;
  /** Opaque server version/cursor used for optimistic concurrency. */
  version?: string;
  /** Soft-delete tombstone flag. */
  deleted: boolean;
}

/** Primitive TinyBase row shape for the entities table. */
export interface EntityRow {
  collection: string;
  entityId: string;
  /** JSON-encoded entity payload. */
  data: string;
  updatedAt: string;
  version: string;
  deleted: boolean;
}

/** Decoded, application-facing outbox mutation. */
export interface OutboxMutation<TArgs = Record<string, unknown>> {
  /** Stable client-generated id, echoed by the server on ack/nack. */
  mutationId: string;
  collection: string;
  operation: OutboxOperation;
  /** Target entity id (absent for some create operations). */
  entityId?: string;
  /** Decoded mutation arguments/payload. */
  args: TArgs;
  /** Entity version the mutation was based on (for conflict detection). */
  baseVersion?: string;
  createdAt: string;
  lastAttemptAt?: string;
  attemptCount: number;
  status: OutboxStatus;
  /** Auth user id at enqueue time; replay is skipped if it no longer matches. */
  userId?: string;
}

/** Primitive TinyBase row shape for the outbox table. */
export interface OutboxRow {
  collection: string;
  operation: OutboxOperation;
  entityId: string;
  /** JSON-encoded mutation arguments. */
  args: string;
  baseVersion: string;
  createdAt: string;
  lastAttemptAt: string;
  attemptCount: number;
  status: OutboxStatus;
  userId: string;
}

/** Monotonic sync cursor for a given server stream. */
export interface SyncCursor {
  stream: string;
  cursor: string;
  updatedAt: string;
}

/** Captured conflict awaiting resolution. */
export interface SyncConflict<TData = Record<string, unknown>> {
  conflictId: string;
  mutationId: string;
  collection: string;
  entityId: string;
  localData: TData;
  serverData: TData;
  createdAt: string;
  dismissed: boolean;
}
