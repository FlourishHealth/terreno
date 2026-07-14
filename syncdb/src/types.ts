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
  /**
   * C1: the stream's stable frontier at emit time. The client advances its cursor to
   * `min(seq, frontierSeq)` so a delta observed out of commit order never advances a
   * cursor past an uncommitted hole. Absent from older servers (treated as `seq`).
   */
  frontierSeq?: number;
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
  /**
   * Set when the document write succeeded but the server's post-hook threw
   * (informational only — never a reason to retry, roll back, or treat this
   * as anything other than a full success).
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
  /** The server document's current seq (conflict nacks). */
  serverSeq?: number;
  message?: string;
  /**
   * Minimum time (ms) the client should wait before retrying, filled by the
   * server with the remaining rate-limit window (`rate_limited` nacks only).
   */
  retryAfterMs?: number;
}

/**
 * A batch of client mutations sent via `sync:mutateBatch` or
 * `POST /sync/mutate/batch`. The server applies strictly in array order and
 * stops at the first non-ack outcome.
 */
export interface SyncMutateBatchRequest {
  /** Ordered mutations; each still carries its own mutationId. */
  mutations: SyncMutateRequest[];
  /**
   * Client-generated correlation id, socket transport only (ignored over
   * HTTP). Echoed back immediately via `sync:batchReceived {batchId}` before
   * processing begins, distinguishing "unsupported" (silence past the grace
   * period) from "slow" (a receipt arrived; keep waiting).
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
 * every mutation after it was NOT attempted — still safe to resend later.
 */
export interface SyncMutateBatchResponse {
  results: SyncMutateBatchResult[];
}

/** One entity in a `GET /sync/snapshot` page. */
export interface SyncSnapshotEntity {
  id: string;
  data: unknown;
  seq: number;
  deleted: boolean;
}

/** Response shape of `GET /sync/snapshot` (C2: one stream per request). */
export interface SyncSnapshotResponse {
  /** The stream this page belongs to (echoed from the request). */
  stream: string;
  entities: SyncSnapshotEntity[];
  /** Highest seq in this page (never above `frontierSeq`); pass back as `cursor`. */
  cursor: number;
  hasMore: boolean;
  /** C1: the stream's stable frontier — the client must not advance its cursor beyond this. */
  frontierSeq: number;
  /**
   * C7: the lowest seq still retained for the stream. A stored cursor below this means
   * compacted tombstones may have been missed → re-bootstrap the stream from 0.
   */
  oldestRetainedSeq: number;
  /**
   * C3: opaque forward token for paging the legacy (seq-0) stratum by `_id`. Echoed back
   * verbatim until absent (stratum exhausted), then paging proceeds by seq.
   */
  legacyCursor?: string;
}

/** One stream a user currently belongs to, from `GET /sync/streams`. */
export interface SyncStreamInfo {
  /** Stream key (e.g. "todos|owner:123"). */
  stream: string;
  /** Collection tag the stream belongs to. */
  collection: string;
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
  /** Diagnostic total attempt count across every send (transport + error-nack). */
  attemptCount: number;
  /** Retry-budget counter incremented only on server error-nacks (see MAX_ERROR_NACK_ATTEMPTS). */
  errorNackCount: number;
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
  /** Count of mutations in the terminal `failed` state. */
  failedCount: number;
  /**
   * Set when replay is paused because the server rejected our auth (401 /
   * AuthRequiredError / unauthorized nack / socket auth rejection). Clears
   * automatically when the same user re-authenticates and replay resumes.
   */
  paused?: "auth";
  /**
   * Number of distinct entities currently blocked from draining (B4): an
   * unresolved conflict, or a terminal validation failure whose successors
   * are skipped-and-surfaced pending `client.retryFailed({entityId})`.
   */
  blockedEntities: number;
  /** True while a replay/drain is actively in flight for the current user. */
  draining: boolean;
  /** Mutations attempted so far in the current (or most recent) drain call. */
  sentThisDrain: number;
  /** Queue length observed when the current (or most recent) drain call began. */
  totalThisDrain: number;
  /** Per-stream cursors (stream key → highest applied seq). */
  streams: Record<string, number>;
  /**
   * E3(c)/(a): local persistence health. `"durable"` (default) means the
   * platform persister is backed by real storage (IndexedDB/SQLite);
   * `"memory"` means the web factory fell back to in-memory persistence
   * (no `globalThis.indexedDB` in this environment — data will not survive a
   * reload); `"error"` means the last load attempt hit a storage READ error
   * (distinct from "no data") and the client deliberately skipped autosave to
   * avoid clobbering a still-possibly-intact persisted blob.
   */
  persistence: "durable" | "memory" | "error";
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
  /**
   * Optional silent token refresh. When present, the client calls it exactly
   * once per auth-pause episode before surfacing the pause to the app;
   * resolving `true` means the refresh likely succeeded and replay should be
   * retried immediately. Adapters without a meaningful refresh path (or that
   * refresh transparently inside `getToken`) may omit this.
   */
  refresh?: () => Promise<boolean>;
}
