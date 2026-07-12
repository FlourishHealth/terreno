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
  /**
   * C7: tombstone retention window in days (default 90). Tombstones older than this may
   * be hard-deleted by the `compactTombstones` maintenance script; a client whose cursor
   * predates the retained floor re-bootstraps (see `oldestRetainedSeq`).
   */
  retentionDays?: number;
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

/**
 * Response shape for `GET /sync/snapshot` (C2: one stream per request).
 */
export interface SyncSnapshotResponse {
  /** The stream this page belongs to (echoed from the request). */
  stream: string;
  entities: SyncEntityPayload[];
  /**
   * Highest seq included in this page (C1: never above `frontierSeq`); pass back as
   * `cursor` to continue.
   */
  cursor: number;
  /** True when more pages remain past `cursor` (more committed OR uncommitted seqs). */
  hasMore: boolean;
  /** C1: the stream's stable frontier — the client must not advance its cursor beyond this. */
  frontierSeq: number;
  /**
   * C7: the lowest seq still retained for this stream after tombstone compaction. A
   * client whose stored cursor is below this may have missed compacted tombstones and
   * must re-bootstrap the stream from 0 (sanctioned wipe: retention gap, not auth).
   */
  oldestRetainedSeq: number;
  /**
   * C3: opaque forward token for paging the legacy (seq-0) stratum by `_id`. Present
   * while unstamped legacy documents remain; absent once the stratum is exhausted and
   * paging proceeds by seq. The client echoes it back verbatim.
   */
  legacyCursor?: string;
}

/** One stream a user currently belongs to, from `GET /sync/streams`. */
export interface SyncStreamInfo {
  /** The stream key (e.g. "todos|owner:123"). */
  stream: string;
  /** The collection tag the stream belongs to. */
  collection: string;
}

/** Response shape for `GET /sync/streams`. */
export interface SyncStreamsResponse {
  streams: SyncStreamInfo[];
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
  /**
   * C5 (FIX 6): set when the document write succeeded and the ledger
   * finalized `applied`, but the model's post-hook (`postCreate`/
   * `postUpdate`/`postDelete`) threw. The mutation is still a full success —
   * this is informational only, never a reason to retry or roll back.
   */
  warning?: string;
}

export type SyncNackCode = "conflict" | "unauthorized" | "validation" | "error" | "rate_limited";

/** Rejected mutation. Conflict nacks carry the canonical server document. */
export interface SyncNack {
  mutationId: string;
  code: SyncNackCode;
  /** Canonical serialized server document (conflict nacks). */
  serverDoc?: unknown;
  /** The server document's current `_syncSeq` (conflict nacks). */
  serverSeq?: number;
  message?: string;
  /**
   * Minimum time (ms) the client should wait before retrying, filled by the
   * server with the remaining rate-limit window (`rate_limited` nacks only).
   */
  retryAfterMs?: number;
}

/**
 * A batch of client mutations delivered via `sync:mutateBatch` or
 * `POST /sync/mutate/batch`. The server MUST apply strictly in array order and
 * stop at the first non-ack outcome (see `applySyncMutationBatch`).
 */
export interface SyncMutateBatchRequest {
  /** Ordered mutations; each still carries its own mutationId. */
  mutations: SyncMutateRequest[];
  /**
   * Client-generated correlation id, socket transport only (ignored over
   * HTTP). Echoed back immediately via `sync:batchReceived {batchId}` before
   * processing begins, so the client can distinguish "the server has no
   * sync:mutateBatch handler" (silence past the grace period, batching
   * unsupported) from "the server is just slow to finish this batch" (a
   * receipt arrived; keep waiting up to the full batch timeout).
   */
  batchId?: string;
}

/** One result per PROCESSED mutation in a batch, in request order. */
export type SyncMutateBatchResult = {type: "ack"; ack: SyncAck} | {type: "nack"; nack: SyncNack};

/**
 * Response to a batch mutation request.
 *
 * `results.length < request.mutations.length` means the server halted at the
 * first non-ack: `results[results.length - 1]` is that failing outcome, and
 * every mutation after it was NOT attempted (not ledgered, not applied) —
 * still safe to resend in a later batch (INV-3).
 */
export interface SyncMutateBatchResponse {
  results: SyncMutateBatchResult[];
}

/**
 * A change event delivered to subscribed clients via `sync:delta`.
 *
 * ## Per-entity ordering & the LWW-by-seq contract (C8)
 *
 * The server serializes delta dispatch PER entity (`{collection}:{id}`): two deltas for
 * the same document are always emitted in change-stream (commit) order, so their `seq`
 * values arrive monotonically for that entity. Deltas for DIFFERENT entities may arrive
 * in any order (they dispatch concurrently). Clients therefore apply last-writer-wins
 * BY SEQ within an entity: a delta whose `seq` is at or below the entity's applied seq is
 * an idempotent no-op; only a strictly higher `seq` mutates local state. Combined with
 * the C1 frontier (`frontierSeq`), a cursor never advances past an uncommitted seq, so no
 * committed delta is ever permanently skipped.
 */
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
  /**
   * C1: the stream's stable frontier at emit time. The client advances its cursor to
   * `min(seq, frontierSeq)` so a delta observed out of commit order never advances a
   * cursor past an uncommitted hole.
   */
  frontierSeq?: number;
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
