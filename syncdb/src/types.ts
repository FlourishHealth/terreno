/**
 * Core types for @terreno/syncdb.
 *
 * The protocol types (deltas, mutations, acks) mirror the server contract defined in
 * @terreno/api's `src/sync/types.ts` — they are duplicated intentionally so this
 * frontend package carries no backend dependency. Keep the two in lockstep.
 */

export type SyncMutationOperation = "create" | "update" | "delete";

/** A change event delivered by the server via `sync:delta`. */
export interface SyncDelta {
  /** Collection tag (e.g. "todos"). */
  collection: string;
  /** Document id. */
  id: string;
  method: SyncMutationOperation;
  /** Serialized document data (omitted for tombstone deltas emitted to a previous stream). */
  data?: unknown;
  /** The document's per-stream sequence (`_syncSeq`). */
  seq: number;
  /** Stream key this delta belongs to (e.g. "todos|owner:123"). */
  stream: string;
  /** True when the entity is soft-deleted. */
  deleted?: boolean;
}

/** A client mutation sent via `sync:mutate` or `POST /sync/mutate`. */
export interface SyncMutateRequest {
  /** Client-generated stable id; the idempotency key. */
  mutationId: string;
  collection: string;
  operation: SyncMutationOperation;
  /** Target document id (required for update/delete). */
  id?: string;
  /** Fields to write (create/update). */
  data?: Record<string, unknown>;
  /** The seq the client last saw for this document; enables LWW conflict detection. */
  baseVersion?: number;
}

/** Successful mutation acknowledgement. */
export interface SyncAck {
  mutationId: string;
  /** The document id (server-assigned for creates). */
  id: string;
  /** The document's new seq. */
  seq: number;
}

export type SyncNackCode = "conflict" | "unauthorized" | "validation" | "error";

/** Rejected mutation. Conflict nacks carry the canonical server document. */
export interface SyncNack {
  mutationId: string;
  code: SyncNackCode;
  /** Canonical serialized server document (conflict nacks). */
  serverDoc?: unknown;
  /** The server document's current seq (conflict nacks). */
  serverSeq?: number;
  message?: string;
}

/** One entity in a `GET /sync/snapshot` page. */
export interface SyncSnapshotEntity {
  id: string;
  data: unknown;
  seq: number;
  deleted: boolean;
}

/** Response shape of `GET /sync/snapshot`. */
export interface SyncSnapshotResponse {
  entities: SyncSnapshotEntity[];
  cursor: number;
  hasMore: boolean;
}

/** Durable outbox mutation lifecycle. */
export type OutboxStatus = "queued" | "inFlight" | "acked" | "conflicted" | "failed";

/** A locally queued mutation awaiting server acknowledgement. */
export interface OutboxMutation {
  mutationId: string;
  collection: string;
  operation: SyncMutationOperation;
  entityId: string;
  /** JSON-serialized mutation args. */
  args: string;
  baseVersion?: number;
  status: OutboxStatus;
  attemptCount: number;
  /** The user this mutation belongs to; replay skips mutations from other users. */
  userId: string;
  createdAt: string;
}

/** An unresolved conflict between a local mutation and the canonical server state. */
export interface SyncConflict {
  mutationId: string;
  collection: string;
  entityId: string;
  /** JSON-serialized local (optimistic) entity data. */
  localData: string;
  /** JSON-serialized canonical server entity data. */
  serverData: string;
  serverSeq: number;
  dismissed: boolean;
}

export type ConflictResolutionStrategy = "useServer" | "keepMine";

/** Aggregate sync state for status UI. */
export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  queuedCount: number;
  conflictCount: number;
  /** Per-stream cursors (stream key → highest applied seq). */
  streams: Record<string, number>;
}

/**
 * Narrow authentication surface consumed by syncdb. Satisfied by the Better Auth
 * adapter shipped in this package; syncdb never manages tokens itself.
 */
export interface AuthProvider {
  /** Current bearer/session token, or null when signed out. Called per request. */
  getToken: () => Promise<string | null>;
  /** Current user id, or null when signed out. */
  getUserId: () => Promise<string | null>;
  /** Subscribe to auth changes (login, logout, user switch). Returns unsubscribe. */
  onAuthChange: (callback: () => void) => () => void;
}
