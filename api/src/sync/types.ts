/**
 * Shared types for the SyncDB local-first sync protocol.
 *
 * These types are the contract between @terreno/api (server) and @terreno/syncdb (client):
 * scope/stream configuration, snapshot payloads, mutation requests, and delta events.
 * See docs/implementationPlans/syncdb-local-first.md.
 */

/** Scope a collection's streams by document owner (default field: `ownerId`). */
export interface SyncScopeOwner {
  type: "owner";
  /** Field holding the owning user's id. Defaults to "ownerId". */
  field?: string;
}

/** Scope a collection's streams by a tenant/workspace field (e.g. `organizationId`). */
export interface SyncScopeTenant {
  type: "tenant";
  /** Field holding the tenant/workspace id. */
  field: string;
}

/** A single shared stream for the whole collection (all authenticated users). */
export interface SyncScopeBroadcast {
  type: "broadcast";
}

/**
 * Custom scope resolver: given a document, return its scope value (e.g. a workspace id).
 * The stream key becomes `{collection}|custom:{value}`.
 */
export type SyncScopeResolver = (doc: Record<string, unknown>) => string;

export type SyncScope = SyncScopeOwner | SyncScopeTenant | SyncScopeBroadcast | SyncScopeResolver;

/**
 * Configuration for local-first sync on a modelRouter, parallel to `realtime`.
 * Requires the model schema to use `isDeletedPlugin` (soft delete) and `syncPlugin`
 * (seq stamping) — validated at registration.
 */
export interface SyncConfig {
  /** Which stream a document belongs to. Multi-tenant by default via the tenant scope. */
  scope: SyncScope;
  /**
   * Custom serializer for sync payloads (snapshot entities and deltas).
   * Falls back to the modelRouter responseHandler, then the document's toJSON.
   */
  responseHandler?: (doc: Record<string, unknown>, method: SyncMutationOperation) => unknown;
  /**
   * Server-side query restricting snapshots to the caller's documents. Derived
   * automatically for owner scopes ({field: user.id}) and tenant scopes
   * ({field: {$in: getUserScopes(...)}}); REQUIRED for custom resolver scopes, whose
   * stream function cannot be inverted into a Mongo query.
   */
  snapshotFilter?: (user: {
    id: string;
  }) => Record<string, unknown> | Promise<Record<string, unknown>>;
}

export type SyncMutationOperation = "create" | "update" | "delete";

/** A single entity in a snapshot response. */
export interface SyncEntityPayload {
  /** Document id. */
  id: string;
  /** Serialized document data (present for tombstones too, so clients can render conflicts). */
  data: unknown;
  /** The document's `_syncSeq` — the client's per-entity version and cursor source. */
  seq: number;
  /** True when the entity is a soft-delete tombstone. */
  deleted: boolean;
}

/** Response shape for `GET /sync/snapshot`. */
export interface SyncSnapshotResponse {
  entities: SyncEntityPayload[];
  /** Highest seq included in this page; pass back as `cursor` to continue. */
  cursor: number;
  /** True when more pages remain past `cursor`. */
  hasMore: boolean;
}

/** A client mutation delivered via `sync:mutate` or `POST /sync/mutate`. */
export interface SyncMutateRequest {
  /** Client-generated stable id; the idempotency key. */
  mutationId: string;
  /** Collection tag (e.g. "todos"). */
  collection: string;
  operation: SyncMutationOperation;
  /** Target document id (required for update/delete; client-generated allowed for create). */
  id?: string;
  /** Fields to write (create/update). */
  data?: Record<string, unknown>;
  /** The `_syncSeq` the client last saw for this document; enables LWW conflict detection. */
  baseVersion?: number;
}

/** Successful mutation acknowledgement. */
export interface SyncAck {
  mutationId: string;
  /** The document id (server-assigned for creates). */
  id: string;
  /** The document's new `_syncSeq`. */
  seq: number;
}

export type SyncNackCode = "conflict" | "unauthorized" | "validation" | "error";

/** Rejected mutation. Conflict nacks carry the canonical server document. */
export interface SyncNack {
  mutationId: string;
  code: SyncNackCode;
  /** Canonical serialized server document (conflict nacks). */
  serverDoc?: unknown;
  /** The server document's current `_syncSeq` (conflict nacks). */
  serverSeq?: number;
  message?: string;
}

/** A change event delivered to subscribed clients via `sync:delta`. */
export interface SyncDelta {
  /** Collection tag (e.g. "todos"). */
  collection: string;
  /** Document id. */
  id: string;
  method: SyncMutationOperation;
  /** Serialized document data (omitted for tombstone deltas emitted to a previous stream). */
  data?: unknown;
  /** The document's `_syncSeq`. */
  seq: number;
  /** Stream key this delta belongs to (e.g. "todos|owner:123"). */
  stream: string;
  /** True when the entity is soft-deleted. */
  deleted?: boolean;
}

/** Fields added to synced documents by `syncPlugin`. */
export interface SyncedDocumentFields {
  /** Monotonic per-stream sequence stamped on every synced write. */
  _syncSeq?: number;
  /**
   * The document's previous stream key, set when a write moved the document between
   * scopes (owner/tenant change); null when the last write did not move it.
   */
  _syncPrevStream?: string | null;
}
