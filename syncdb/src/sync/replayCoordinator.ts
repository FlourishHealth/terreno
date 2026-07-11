import type {SyncDebugLog} from "../debug/debugLog";
import {listConflicts, writeConflict} from "../mutations/conflicts";
import type {Outbox} from "../mutations/outbox";
import type {SyncStore} from "../storage/store";
import type {
  OutboxMutation,
  SyncAck,
  SyncMutateBatchRequest,
  SyncMutateRequest,
  SyncNack,
} from "../types";
import {AuthRequiredError} from "./httpChannel";
import {
  DEFAULT_BATCH_SIZE,
  type SendMutationBatchResult,
  type SendMutationResult,
} from "./transport";

/** Error-nack retries beyond this attempt count become terminal failures. */
export const MAX_ERROR_NACK_ATTEMPTS = 5;

/** Base delay for the error-nack exponential backoff (doubles per attempt). */
export const ERROR_NACK_BASE_BACKOFF_MS = 1_000;

/** Base delay for transport-failure backoff (unlimited retries, same cap/jitter shape). */
export const TRANSPORT_FAILURE_BASE_BACKOFF_MS = 1_000;

/** Cap applied to every jittered backoff (error-nack and transport-failure alike). */
export const MAX_BACKOFF_MS = 30_000;

export interface ReplayResult {
  /** Set when replay stopped early because the server rejected our auth. */
  paused?: "auth";
}

export interface ReplayCoordinator {
  /**
   * Drain the user's queued mutations in one global FIFO pass ordered by
   * `enqueueOrder` (INV-1) — never per-collection parallel. Resolves once the
   * queue is fully empty or parked (auth pause, or every remaining mutation is
   * backing off). A second call for the same user while one is running
   * returns the in-flight promise.
   */
  replay: (args: {userId: string}) => Promise<ReplayResult>;
  /**
   * Clear the single armed wake-up timer (if any) for a user. Called from
   * `client.stop()` so no post-stop send can fire.
   */
  dispose: (args?: {userId?: string}) => void;
  /**
   * Re-probe batch support on the next drain (B3): called on transport
   * reconnect, since a previous `batchUnsupported` determination may have been
   * against an old server that has since been upgraded (or the reconnect landed
   * on a different, batch-capable instance behind a load balancer).
   */
  notifyReconnect: () => void;
  /**
   * Re-enable an entity's blocked queued successors (B4) after a terminal
   * validation failure: subsequent drains stop skipping mutations for this
   * entity. Does not touch unresolved conflicts — those clear via
   * `resolveConflict`.
   */
  retryFailed: (args: {entityId: string}) => void;
  /** Entity ids currently blocked by an unresolved conflict or a skipped validation failure (B4). */
  getBlockedEntities: (args: {userId: string}) => string[];
  /**
   * Current drain progress snapshot for a user (B5): `draining` is true only
   * while a `replay()` call for this user is in flight. `sentThisDrain` /
   * `totalThisDrain` reflect the most recent (or in-progress) drain.
   */
  getDrainProgress: (args: {userId: string}) => {
    draining: boolean;
    sentThisDrain: number;
    totalThisDrain: number;
  };
}

export interface CreateReplayCoordinatorArgs {
  store: SyncStore;
  outbox: Outbox;
  sendMutation: (request: SyncMutateRequest) => Promise<SendMutationResult>;
  /**
   * Batch send function (B3). When present, the coordinator builds contiguous
   * chunks of the global FIFO queue (≤ `batchSize`) and sends them here instead
   * of one `sendMutation` per mutation, falling back to single sends when the
   * batch transport reports `unsupported` or is absent.
   */
  sendMutationBatch?: (request: SyncMutateBatchRequest) => Promise<SendMutationBatchResult>;
  /** Max mutations per batch chunk (default {@link DEFAULT_BATCH_SIZE}). */
  batchSize?: number;
  /**
   * When true (B4), a conflict halts the ENTIRE drain instead of just blocking
   * its entity. Default false (per-entity blocking).
   */
  haltQueueOnConflict?: boolean;
  /** Millisecond clock, injectable for deterministic backoff tests. */
  now?: () => number;
  /** Random source in [0, 1), injectable for deterministic jitter tests. */
  random?: () => number;
  /** Optional debug log; when present, each mutation outcome is recorded. */
  debug?: SyncDebugLog;
  /**
   * Called whenever a drain parks on an armed wake-up timer, so the host can
   * schedule the callback (defaults to the global `setTimeout`/`clearTimeout`).
   */
  setTimeoutFn?: (handler: () => void, ms: number) => unknown;
  clearTimeoutFn?: (handle: unknown) => void;
  /**
   * Called after a drain pass that made forward progress (at least one ack)
   * so the caller can prune acked rows (A5). Optional — tests that don't care
   * about pruning may omit it.
   */
  onDrainPass?: (args: {userId: string}) => void;
  /**
   * Called the first time a drain pass for a user enters the auth-paused
   * state (A4). Not called again until the pause clears and re-triggers.
   */
  onAuthPause?: (args: {userId: string}) => void;
  /**
   * B5: called after each mutation/chunk send attempt with drain progress —
   * `sentThisDrain` (attempts made so far in this `replay()` call) and
   * `totalThisDrain` (queue length observed when this `replay()` call began,
   * a lower bound since more may enqueue mid-drain). Lets the host surface a
   * progress indicator (e.g. "12 / 40 synced").
   */
  onProgress?: (args: {userId: string; sentThisDrain: number; totalThisDrain: number}) => void;
  /**
   * Consulted before every drain attempt — including internally-scheduled
   * ones (the armed wake-up timer and the mid-drain-enqueue recheck) that
   * bypass the caller's own call site. Lets the host gate sending on state the
   * coordinator does not itself track (simulated offline, auth pause at the
   * client level). Defaults to always-allow.
   */
  shouldDrain?: () => boolean;
}

const entityKey = (collection: string, entityId: string): string => `${collection}:${entityId}`;

/**
 * Bridges the durable outbox and the send channel, resolving each mutation's
 * server outcome:
 *
 * - **ack** → markAcked, clear the entity's `pendingMutationId` (when it still
 *   belongs to this mutation) and stamp the acked seq;
 * - **nack conflict** → markConflicted + record a `_conflicts` row; the
 *   entity's optimistic state stays in place until the user resolves. The
 *   ENTITY is blocked (B4): later drains skip its other queued mutations
 *   until the conflict resolves, unless `haltQueueOnConflict` is set, in
 *   which case the whole drain halts instead;
 * - **nack unauthorized** / thrown `AuthRequiredError` → back to queued and
 *   pause replay for the user (`{paused: "auth"}`), consuming NO retry budget
 *   (INV-2); the next replay call (after re-auth) retries;
 * - **nack validation** → markFailed (terminal) and release the entity's
 *   `pendingMutationId` so future deltas are not blocked forever. The ENTITY
 *   is blocked (B4) — its queued successors are skipped until `retryFailed`;
 * - **nack error** → back to queued with jittered exponential backoff against
 *   the dedicated `errorNackCount` budget, terminal markFailed after
 *   {@link MAX_ERROR_NACK_ATTEMPTS} attempts. HALTS THE WHOLE DRAIN (B4);
 * - **send rejection** (timeout / network / disconnect) → back to queued with
 *   unlimited jittered exponential backoff (never terminal, never burns the
 *   error-nack budget) and the drain parks until the backoff elapses. HALTS
 *   THE WHOLE DRAIN (B4).
 *
 * The drain is a SINGLE global FIFO over `enqueueOrder` (INV-1) — no more
 * per-collection parallelism. `replay()` keeps re-running drain passes until
 * the queue is empty or parked; when it parks on a backoff, a single
 * `setTimeout` wakes the next drain automatically so callers never need to
 * poll.
 *
 * B3 layers a batched send on top: each pass sends the next contiguous chunk
 * of the FIFO queue (≤ `batchSize`, at most one mutation per entity per
 * chunk) through `sendMutationBatch` when available, walking the results in
 * order with the same per-outcome handlers above, then applying the B4
 * stop-the-line policy to whatever the batch response implies. Chunks with no
 * eligible mutations (everything blocked/backing off) fall through exactly
 * like the single-send path.
 */
export const createReplayCoordinator = ({
  store,
  outbox,
  sendMutation,
  sendMutationBatch,
  batchSize = DEFAULT_BATCH_SIZE,
  haltQueueOnConflict = false,
  now = () => Date.now(),
  random = () => Math.random(),
  debug,
  setTimeoutFn = (handler, ms) => setTimeout(handler, ms),
  clearTimeoutFn = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  onDrainPass,
  onAuthPause,
  onProgress,
  shouldDrain = () => true,
}: CreateReplayCoordinatorArgs): ReplayCoordinator => {
  const inFlightReplays = new Map<string, Promise<ReplayResult>>();
  /**
   * Set when a `replay()` call coalesces into an already-running drain whose
   * final pass may have already observed the queue as empty (a narrow race:
   * the in-flight promise's cleanup runs on a later microtask than the
   * enqueue that prompted this call). Consumed once the in-flight promise
   * settles to schedule exactly one immediate follow-up drain, so a mutation
   * enqueued mid-drain is never stranded until an unrelated external trigger.
   */
  const recheckRequested = new Set<string>();
  /** mutationId → earliest epoch-ms the next attempt may run (error-nack backoff). */
  const retryAt = new Map<string, number>();
  /** mutationId → count of transport-failure attempts (in-memory only; unlimited budget). */
  const transportFailures = new Map<string, number>();
  /** userId → armed wake-up timer handle (never more than one per user). */
  const wakeTimers = new Map<string, unknown>();
  /** userId → whether onAuthPause has already fired for the current pause episode. */
  const authPauseNotified = new Set<string>();
  /**
   * B4: entities blocked by a terminal validation failure whose queued
   * successors must be skipped until `retryFailed({entityId})`. Keyed by
   * `${collection}:${entityId}`. Unresolved-conflict blocking is derived live
   * from the `_conflicts` table instead (it already tracks resolution).
   */
  const validationBlockedEntities = new Set<string>();
  /** userId → {sent, total} progress counters for the CURRENT replay() call (B5). */
  const drainProgress = new Map<string, {sent: number; total: number}>();

  const reportProgress = (userId: string, sentDelta: number): void => {
    if (!onProgress) {
      return;
    }
    const progress = drainProgress.get(userId);
    if (!progress) {
      return;
    }
    progress.sent += sentDelta;
    onProgress({sentThisDrain: progress.sent, totalThisDrain: progress.total, userId});
  };
  /**
   * B3: per-connection flag set when the batch transport reports
   * `unsupported` (HTTP 404 / socket silence past the grace timeout).
   * Cleared by `notifyReconnect()` so a later reconnect re-probes — the new
   * connection may land on an upgraded server or a different instance.
   */
  let batchUnsupported = false;

  const clearWakeTimer = (userId: string): void => {
    const handle = wakeTimers.get(userId);
    if (handle !== undefined) {
      clearTimeoutFn(handle);
      wakeTimers.delete(userId);
    }
  };

  const armWakeTimer = (userId: string, delayMs: number): void => {
    clearWakeTimer(userId);
    const handle = setTimeoutFn(() => {
      wakeTimers.delete(userId);
      void replay({userId});
    }, delayMs);
    wakeTimers.set(userId, handle);
  };

  /** Full jitter: random(0, base * 2^(attempt-1)), capped at MAX_BACKOFF_MS. */
  const jitteredBackoff = (attempt: number, baseMs: number): number => {
    const cap = Math.min(MAX_BACKOFF_MS, baseMs * 2 ** (attempt - 1));
    return Math.floor(random() * cap);
  };

  const buildRequest = (mutation: OutboxMutation): SyncMutateRequest => {
    const request: SyncMutateRequest = {
      collection: mutation.collection,
      id: mutation.entityId,
      mutationId: mutation.mutationId,
      operation: mutation.operation,
    };
    // A2: send-time baseVersion refresh. The entity's CURRENT seq is used as
    // the base when it is NEWER than the value captured at enqueue time — the
    // stored value is the floor, never sent lower. A prior mutation in the
    // same queue may have already acked (stamping the entity's seq via
    // releaseEntity) since this mutation was enqueued; reading the live seq
    // here chains bases correctly through a queue of edits to one entity
    // without any coalescing.
    if (mutation.operation !== "create") {
      const entity = store.getEntity({collection: mutation.collection, id: mutation.entityId});
      const liveSeq = entity?.seq;
      const floor = mutation.baseVersion;
      const base =
        liveSeq !== undefined && (floor === undefined || liveSeq > floor) ? liveSeq : floor;
      if (base !== undefined) {
        request.baseVersion = base;
      }
    } else if (mutation.baseVersion !== undefined) {
      request.baseVersion = mutation.baseVersion;
    }
    if (mutation.operation !== "delete") {
      try {
        request.data = JSON.parse(mutation.args) as Record<string, unknown>;
      } catch {
        request.data = {};
      }
    }
    return request;
  };

  /** Clear the entity's pendingMutationId when it still points at this mutation. */
  const releaseEntity = (mutation: OutboxMutation, seq?: number): void => {
    const entity = store.getEntity({collection: mutation.collection, id: mutation.entityId});
    if (!entity) {
      return;
    }
    const ownsPending = entity.pendingMutationId === mutation.mutationId;
    if (!ownsPending && seq === undefined) {
      return;
    }
    store.upsertEntity({
      collection: mutation.collection,
      data: entity.data,
      id: mutation.entityId,
      pendingMutationId: ownsPending ? "" : undefined,
      seq,
    });
  };

  const handleAck = (mutation: OutboxMutation, ack: SyncAck): void => {
    outbox.markAcked({mutationId: mutation.mutationId});
    retryAt.delete(mutation.mutationId);
    transportFailures.delete(mutation.mutationId);
    releaseEntity(mutation, ack.seq);
    debug?.record({
      collection: mutation.collection,
      direction: "inbound",
      entityId: mutation.entityId,
      label: `ack ${mutation.collection}/${mutation.entityId} @${ack.seq}`,
      mutationId: mutation.mutationId,
      ok: true,
      operation: mutation.operation,
      seq: ack.seq,
      type: "ack",
    });
  };

  const handleConflict = (mutation: OutboxMutation, nack: SyncNack): void => {
    outbox.markConflicted({mutationId: mutation.mutationId});
    retryAt.delete(mutation.mutationId);
    transportFailures.delete(mutation.mutationId);
    const entity = store.getEntity({collection: mutation.collection, id: mutation.entityId});
    writeConflict({
      conflict: {
        collection: mutation.collection,
        dismissed: false,
        entityId: mutation.entityId,
        localData: JSON.stringify(entity?.data ?? null),
        mutationId: mutation.mutationId,
        serverData: JSON.stringify(nack.serverDoc ?? null),
        serverSeq: nack.serverSeq ?? 0,
      },
      store,
    });
    debug?.record({
      collection: mutation.collection,
      detail: {message: nack.message, serverSeq: nack.serverSeq},
      direction: "inbound",
      entityId: mutation.entityId,
      label: `conflict ${mutation.collection}/${mutation.entityId}`,
      mutationId: mutation.mutationId,
      ok: false,
      operation: mutation.operation,
      type: "conflict",
    });
  };

  const handleTerminalFailure = (mutation: OutboxMutation, reason: string): void => {
    outbox.markFailed({mutationId: mutation.mutationId});
    retryAt.delete(mutation.mutationId);
    transportFailures.delete(mutation.mutationId);
    // A failed mutation never replays; leaving pendingMutationId set would
    // block server deltas for this entity forever.
    releaseEntity(mutation);
    debug?.record({
      collection: mutation.collection,
      detail: {reason},
      direction: "inbound",
      entityId: mutation.entityId,
      label: `failed ${mutation.collection}/${mutation.entityId} (${reason})`,
      mutationId: mutation.mutationId,
      ok: false,
      operation: mutation.operation,
      type: "failed",
    });
  };

  /** True when `mutation`'s entity has an unresolved conflict recorded (B4). */
  const hasUnresolvedConflict = (mutation: OutboxMutation): boolean =>
    listConflicts({store}).some(
      (conflict) =>
        conflict.collection === mutation.collection && conflict.entityId === mutation.entityId
    );

  /** True when `mutation`'s entity is blocked (unresolved conflict or skipped validation failure). */
  const isEntityBlocked = (mutation: OutboxMutation): boolean =>
    validationBlockedEntities.has(entityKey(mutation.collection, mutation.entityId)) ||
    hasUnresolvedConflict(mutation);

  /** Outcome of one drain pass over the full FIFO queue. */
  interface DrainPassResult {
    authPaused: boolean;
    /** Earliest backoff wake-up across every parked mutation this pass, if any. */
    nextWakeAt?: number;
    /** True when at least one mutation acked this pass (progress signal for pruning). */
    progressed: boolean;
    /**
     * True when this pass ended for a reason that must stop the CURRENT
     * `replay()` call's drain-until-empty loop even though the queue is
     * neither empty nor backing off with a known wake time: either every
     * remaining queued mutation is B4-blocked (unresolved conflict / skipped
     * validation failure — nothing more can happen until `resolveConflict`
     * or `retryFailed`), or a halting decision fired with no backoff of its
     * own (a plain conflict nack under `haltQueueOnConflict`). Without this,
     * the outer loop would immediately re-call `drainOnce` and either spin
     * forever (blocked case) or silently defeat the halt by draining
     * unrelated entities anyway (haltQueueOnConflict case).
     */
    stopReplayCall?: boolean;
  }

  /**
   * Process one already-resolved outcome for `mutation` (ack/nack), applying
   * the B4 stop-the-line policy. Returns instructions for the caller (single
   * or batched send loop) on whether to keep going.
   */
  interface OutcomeDecision {
    /** True when the drain must stop this pass immediately (no more sends). */
    haltDrain: boolean;
    authPaused: boolean;
    nextWakeAt?: number;
    progressed: boolean;
  }

  const applyAck = (mutation: OutboxMutation, ack: SyncAck): OutcomeDecision => {
    handleAck(mutation, ack);
    return {authPaused: false, haltDrain: false, progressed: true};
  };

  const applyUnauthorized = (mutation: OutboxMutation): OutcomeDecision => {
    outbox.markQueued({mutationId: mutation.mutationId});
    debug?.record({
      collection: mutation.collection,
      detail: {code: "unauthorized", paused: true},
      direction: "inbound",
      entityId: mutation.entityId,
      label: `nack ${mutation.collection}/${mutation.entityId} (unauthorized)`,
      mutationId: mutation.mutationId,
      ok: false,
      operation: mutation.operation,
      type: "nack",
    });
    return {authPaused: true, haltDrain: true, progressed: false};
  };

  const applyConflict = (mutation: OutboxMutation, nack: SyncNack): OutcomeDecision => {
    handleConflict(mutation, nack);
    validationBlockedEntities.delete(entityKey(mutation.collection, mutation.entityId));
    // B4: per-entity blocking is the default; haltQueueOnConflict escalates to
    // a whole-drain halt for apps with cross-entity ordering dependencies.
    return {authPaused: false, haltDrain: haltQueueOnConflict, progressed: false};
  };

  const applyValidation = (mutation: OutboxMutation): OutcomeDecision => {
    handleTerminalFailure(mutation, "validation");
    // B4: the entity's queued successors are skipped-and-surfaced until the
    // user calls retryFailed({entityId}) or resolves the underlying issue —
    // other entities keep draining.
    validationBlockedEntities.add(entityKey(mutation.collection, mutation.entityId));
    return {authPaused: false, haltDrain: false, progressed: false};
  };

  const applyErrorNack = (mutation: OutboxMutation): OutcomeDecision => {
    const beforeCount = outbox.getMutation({mutationId: mutation.mutationId})?.errorNackCount ?? 0;
    const attempts = beforeCount + 1;
    if (attempts >= MAX_ERROR_NACK_ATTEMPTS) {
      handleTerminalFailure(mutation, "error");
      return {authPaused: false, haltDrain: false, progressed: false};
    }
    outbox.markQueuedAfterErrorNack({mutationId: mutation.mutationId});
    const backoffMs = jitteredBackoff(attempts, ERROR_NACK_BASE_BACKOFF_MS);
    const wakeAt = now() + backoffMs;
    retryAt.set(mutation.mutationId, wakeAt);
    debug?.record({
      collection: mutation.collection,
      detail: {attempt: attempts, backoffMs, reason: "error"},
      direction: "system",
      entityId: mutation.entityId,
      label: `retry ${mutation.collection}/${mutation.entityId} (error, ${backoffMs}ms)`,
      mutationId: mutation.mutationId,
      operation: mutation.operation,
      type: "retry",
    });
    // B4: error nacks halt the WHOLE drain (transient — retrying without user
    // action will fix it), unlike the per-entity conflict/validation policy.
    return {authPaused: false, haltDrain: true, nextWakeAt: wakeAt, progressed: false};
  };

  /** Apply a resolved single-mutation SendMutationResult via the B4 outcome table. */
  const applyResult = (mutation: OutboxMutation, result: SendMutationResult): OutcomeDecision => {
    if (result.type === "ack") {
      return applyAck(mutation, result.ack);
    }
    const {nack} = result;
    if (nack.code === "conflict") {
      return applyConflict(mutation, nack);
    }
    if (nack.code === "unauthorized") {
      return applyUnauthorized(mutation);
    }
    if (nack.code === "validation") {
      return applyValidation(mutation);
    }
    return applyErrorNack(mutation);
  };

  /** Apply a transport failure (thrown send / AuthRequiredError) via the B4 outcome table. */
  const applyTransportError = (mutation: OutboxMutation, error: unknown): OutcomeDecision => {
    if (error instanceof AuthRequiredError) {
      // INV-2: never burn a retry budget on an auth failure. Requeue and
      // pause the whole drain; the caller retries after re-auth.
      outbox.markQueued({mutationId: mutation.mutationId});
      debug?.record({
        collection: mutation.collection,
        detail: {code: "unauthorized", paused: true, source: "http"},
        direction: "inbound",
        entityId: mutation.entityId,
        label: `nack ${mutation.collection}/${mutation.entityId} (unauthorized)`,
        mutationId: mutation.mutationId,
        ok: false,
        operation: mutation.operation,
        type: "nack",
      });
      return {authPaused: true, haltDrain: true, progressed: false};
    }
    // Transport failure (timeout, network, disconnect): unlimited retries
    // with jittered capped backoff, tracked separately from the error-nack
    // budget. HALTS THE WHOLE DRAIN (B4) — the whole batch is safe to resend
    // (INV-3).
    outbox.markQueued({mutationId: mutation.mutationId});
    const attempt = (transportFailures.get(mutation.mutationId) ?? 0) + 1;
    transportFailures.set(mutation.mutationId, attempt);
    const backoffMs = jitteredBackoff(attempt, TRANSPORT_FAILURE_BASE_BACKOFF_MS);
    const wakeAt = now() + backoffMs;
    retryAt.set(mutation.mutationId, wakeAt);
    debug?.record({
      collection: mutation.collection,
      detail: {attempt, backoffMs, reason: "transport"},
      direction: "system",
      entityId: mutation.entityId,
      label: `retry ${mutation.collection}/${mutation.entityId} (transport, ${backoffMs}ms)`,
      mutationId: mutation.mutationId,
      operation: mutation.operation,
      type: "retry",
    });
    return {authPaused: false, haltDrain: true, nextWakeAt: wakeAt, progressed: false};
  };

  /**
   * Single-mutation send path (used when no batch transport is configured, or
   * batching is marked unsupported for this connection, or a chunk's only
   * eligible mutation count is 1).
   */
  const sendSingle = async (userId: string, mutation: OutboxMutation): Promise<OutcomeDecision> => {
    outbox.markInFlight({mutationId: mutation.mutationId});
    debug?.record({
      collection: mutation.collection,
      detail: {attempt: mutation.attemptCount + 1},
      direction: "outbound",
      entityId: mutation.entityId,
      label: `send ${mutation.operation} ${mutation.collection}/${mutation.entityId}`,
      mutationId: mutation.mutationId,
      operation: mutation.operation,
      type: "send",
    });
    let result: SendMutationResult;
    try {
      result = await sendMutation(buildRequest(mutation));
    } catch (error) {
      const decision = applyTransportError(mutation, error);
      reportProgress(userId, 1);
      return decision;
    }
    const decision = applyResult(mutation, result);
    reportProgress(userId, 1);
    return decision;
  };

  /**
   * Build the next contiguous chunk of the FIFO queue eligible for a batch
   * send: skips mutations whose entity is currently blocked (B4) or backing
   * off (retryAt in the future), stops BEFORE a backing-off mutation (INV-1 —
   * it must remain the effective head once nothing ahead of it can send), and
   * cuts the chunk short before a second mutation for an entity already
   * included (B3.2) so per-entity chaining stays correct without guessing
   * server-assigned seqs.
   */
  const buildChunk = (
    queued: OutboxMutation[]
  ): {chunk: OutboxMutation[]; blockedWakeAt?: number} => {
    const chunk: OutboxMutation[] = [];
    const seenEntities = new Set<string>();
    let blockedWakeAt: number | undefined;
    for (const mutation of queued) {
      if (chunk.length >= batchSize) {
        break;
      }
      const nextAttemptAt = retryAt.get(mutation.mutationId);
      if (nextAttemptAt !== undefined && now() < nextAttemptAt) {
        // INV-1: a backing-off mutation blocks the entire drain from this
        // point on — stop building the chunk here.
        blockedWakeAt =
          blockedWakeAt === undefined ? nextAttemptAt : Math.min(blockedWakeAt, nextAttemptAt);
        break;
      }
      if (isEntityBlocked(mutation)) {
        // B4: this entity is blocked; skip it (stays queued) but keep
        // scanning — other entities may still be eligible for this chunk.
        continue;
      }
      const key = entityKey(mutation.collection, mutation.entityId);
      if (seenEntities.has(key)) {
        // B3.2: at most one mutation per entity per chunk — cut here.
        break;
      }
      seenEntities.add(key);
      chunk.push(mutation);
    }
    return {blockedWakeAt, chunk};
  };

  /** Send one chunk as a batch; returns the per-mutation outcome decisions and any halt reached. */
  const sendChunk = async (
    userId: string,
    chunk: OutboxMutation[]
  ): Promise<{
    decisions: Map<string, OutcomeDecision>;
    unsupported: boolean;
    haltedAt?: number;
    /** True when the server returned fewer results than mutations sent. */
    shortResponse: boolean;
  }> => {
    const decisions = new Map<string, OutcomeDecision>();
    for (const mutation of chunk) {
      outbox.markInFlight({mutationId: mutation.mutationId});
      debug?.record({
        collection: mutation.collection,
        detail: {attempt: mutation.attemptCount + 1, batch: true},
        direction: "outbound",
        entityId: mutation.entityId,
        label: `send ${mutation.operation} ${mutation.collection}/${mutation.entityId}`,
        mutationId: mutation.mutationId,
        operation: mutation.operation,
        type: "send",
      });
    }
    const request: SyncMutateBatchRequest = {mutations: chunk.map(buildRequest)};
    let response: SendMutationBatchResult;
    try {
      // biome-ignore lint/style/noNonNullAssertion: caller only invokes sendChunk when sendMutationBatch is defined and batching is not marked unsupported.
      response = await sendMutationBatch!(request);
    } catch (error) {
      // Transport failure for the WHOLE chunk: every mutation in it goes back
      // to queued via the same transport-error handling as a single send, and
      // the drain halts (INV-3 — resending the whole chunk is safe).
      let haltedAt: number | undefined;
      for (const mutation of chunk) {
        const decision = applyTransportError(mutation, error);
        decisions.set(mutation.mutationId, decision);
        if (decision.nextWakeAt !== undefined) {
          haltedAt =
            haltedAt === undefined ? decision.nextWakeAt : Math.min(haltedAt, decision.nextWakeAt);
        }
      }
      reportProgress(userId, chunk.length);
      return {decisions, haltedAt, shortResponse: false, unsupported: false};
    }
    if (response.type === "unsupported") {
      // The chunk was marked inFlight before sending (for diagnostics/debug
      // symmetry with the single-send path) but never actually attempted —
      // revert every mutation to queued, untouched budgets, so the fallback
      // single-send pass picks them straight back up.
      for (const mutation of chunk) {
        outbox.markQueued({mutationId: mutation.mutationId});
      }
      return {decisions, shortResponse: false, unsupported: true};
    }
    // Walk results in order (INV-1), applying the same per-outcome handlers as
    // the single-send path, then the B4 stop-the-line policy. Per B2, the
    // server itself stops at the first non-ack and truncates `results`
    // accordingly — but defensively, once THIS pass decides to halt (auth
    // pause in particular — nothing after it may be treated as final), every
    // remaining mutation in the chunk is requeued untouched rather than left
    // stranded `inFlight`, regardless of what a non-conforming server sent.
    let halted = false;
    let haltedAt: number | undefined;
    let processed = 0;
    const shortResponse = response.results.length < chunk.length;
    for (let i = 0; i < chunk.length; i++) {
      const mutation = chunk[i];
      if (halted) {
        outbox.markQueued({mutationId: mutation.mutationId});
        continue;
      }
      const result = response.results[i];
      if (!result) {
        // Server halted mid-batch (results shorter than the request): every
        // mutation with no result goes back to queued, untouched budgets.
        outbox.markQueued({mutationId: mutation.mutationId});
        continue;
      }
      processed += 1;
      const decision = applyResult(mutation, result);
      decisions.set(mutation.mutationId, decision);
      if (decision.haltDrain) {
        halted = true;
        if (decision.nextWakeAt !== undefined) {
          haltedAt = decision.nextWakeAt;
        }
      }
    }
    reportProgress(userId, processed);
    return {decisions, haltedAt, shortResponse, unsupported: false};
  };

  const drainOnce = async (userId: string): Promise<DrainPassResult> => {
    let progressed = false;
    let nextWakeAt: number | undefined;

    for (;;) {
      const queued = outbox.listQueued({userId});
      if (queued.length === 0) {
        return {authPaused: false, nextWakeAt, progressed};
      }

      const useBatch = Boolean(sendMutationBatch) && !batchUnsupported;
      if (!useBatch) {
        // Single-mutation fallback (no batch transport, or marked unsupported):
        // send exactly the FIFO head, honoring blocked/backing-off skips.
        let sentAny = false;
        for (const mutation of queued) {
          const nextAttemptAt = retryAt.get(mutation.mutationId);
          if (nextAttemptAt !== undefined && now() < nextAttemptAt) {
            nextWakeAt =
              nextWakeAt === undefined ? nextAttemptAt : Math.min(nextWakeAt, nextAttemptAt);
            return {authPaused: false, nextWakeAt, progressed};
          }
          if (isEntityBlocked(mutation)) {
            continue;
          }
          const decision = await sendSingle(userId, mutation);
          sentAny = true;
          progressed = progressed || decision.progressed;
          if (decision.authPaused) {
            return {authPaused: true, progressed};
          }
          if (decision.haltDrain) {
            if (decision.nextWakeAt !== undefined) {
              nextWakeAt =
                nextWakeAt === undefined
                  ? decision.nextWakeAt
                  : Math.min(nextWakeAt, decision.nextWakeAt);
            }
            // A halt with no backoff of its own (e.g. a plain conflict nack
            // under haltQueueOnConflict) must still stop the CURRENT
            // replay() call — otherwise the outer loop would immediately
            // drain unrelated entities anyway, defeating the halt.
            return {
              authPaused: false,
              nextWakeAt,
              progressed,
              stopReplayCall: decision.nextWakeAt === undefined,
            };
          }
          break; // re-list after each send so newly-acked bases (A2) apply.
        }
        if (!sentAny) {
          // Nothing eligible this pass (everything blocked/backing off). When
          // nothing is backing off either (nextWakeAt still undefined), every
          // remaining mutation is purely B4-blocked — signal that so the
          // outer drain-until-empty loop stops instead of spinning forever on
          // a queue that can never shrink without an external event.
          return {
            authPaused: false,
            nextWakeAt,
            progressed,
            stopReplayCall: nextWakeAt === undefined,
          };
        }
        continue;
      }

      const {chunk, blockedWakeAt} = buildChunk(queued);
      if (chunk.length === 0) {
        if (blockedWakeAt !== undefined) {
          nextWakeAt =
            nextWakeAt === undefined ? blockedWakeAt : Math.min(nextWakeAt, blockedWakeAt);
        }
        return {
          authPaused: false,
          nextWakeAt,
          progressed,
          stopReplayCall: blockedWakeAt === undefined,
        };
      }
      if (chunk.length === 1) {
        // A lone eligible mutation: sending it as a "batch of one" adds no
        // value and costs an extra round-trip on unsupported servers — reuse
        // the single-send path directly (still counts as this pass's send).
        const decision = await sendSingle(userId, chunk[0]);
        progressed = progressed || decision.progressed;
        if (decision.authPaused) {
          return {authPaused: true, progressed};
        }
        if (decision.haltDrain) {
          if (decision.nextWakeAt !== undefined) {
            nextWakeAt =
              nextWakeAt === undefined
                ? decision.nextWakeAt
                : Math.min(nextWakeAt, decision.nextWakeAt);
          }
          return {
            authPaused: false,
            nextWakeAt,
            progressed,
            stopReplayCall: decision.nextWakeAt === undefined,
          };
        }
        continue;
      }

      const {decisions, unsupported, haltedAt, shortResponse} = await sendChunk(userId, chunk);
      if (unsupported) {
        // B3 capability detection: fall back to single-mutation sends for the
        // rest of this connection's lifetime, re-probed on reconnect.
        batchUnsupported = true;
        continue;
      }
      let authPaused = false;
      for (const decision of decisions.values()) {
        progressed = progressed || decision.progressed;
        if (decision.authPaused) {
          authPaused = true;
        }
      }
      if (authPaused) {
        return {authPaused: true, progressed};
      }
      if (haltedAt !== undefined) {
        nextWakeAt = nextWakeAt === undefined ? haltedAt : Math.min(nextWakeAt, haltedAt);
      }
      // A halt (conflict-with-haltQueueOnConflict, error-nack backoff,
      // transport failure) stops the WHOLE drain this pass, mirroring the
      // single-send path — detect it by re-checking whether any decision
      // requested a halt. A short response (server halted mid-batch with no
      // failing nack for the boundary mutation — e.g. it hasn't finished
      // ledgering yet) halts this pass too (INV-1): the tail already went
      // back to queued untouched, and the next drain resumes from there.
      const anyHalt =
        shortResponse || [...decisions.values()].some((decision) => decision.haltDrain);
      if (anyHalt) {
        // As above: a halt with no backoff of its own (plain conflict under
        // haltQueueOnConflict, or a short response) must stop the CURRENT
        // replay() call, not just this pass.
        return {authPaused: false, nextWakeAt, progressed, stopReplayCall: haltedAt === undefined};
      }
      // Progress made and no halt: loop to build the next chunk immediately
      // (drain-until-empty within this pass too, so a 120-mutation queue
      // drains in ceil(120/batchSize) round-trips within ONE replay() call).
    }
  };

  const replay = ({userId}: {userId: string}): Promise<ReplayResult> => {
    const existing = inFlightReplays.get(userId);
    if (existing) {
      // The running drain may have already taken its final "queue empty"
      // snapshot before this call's mutation was enqueued; request a
      // follow-up check once it settles rather than silently stranding the
      // new mutation until an unrelated external trigger runs.
      recheckRequested.add(userId);
      return existing;
    }
    if (!shouldDrain()) {
      // The host has gated sending off (simulated offline, client-level auth
      // pause, post-stop, etc). Internally-scheduled callers (the wake timer,
      // the recheck above) must respect this exactly like an external caller
      // would — never send, never arm a new timer, never touch retry state.
      return Promise.resolve({});
    }
    // A fresh replay call supersedes any pending timed wake-up — it is about
    // to drain right now.
    clearWakeTimer(userId);
    // B5: (re)start this call's progress counters. `total` is a lower bound —
    // snapshotted once at entry — since more may enqueue mid-drain; onProgress
    // still reports every attempt made.
    drainProgress.set(userId, {sent: 0, total: outbox.listQueued({userId}).length});
    const run = (async (): Promise<ReplayResult> => {
      let authPaused = false;
      let parkedAt: number | undefined;
      // Drain-until-empty: keep re-running passes while there is still work
      // and nothing has parked the queue. shouldDrain() is re-checked before
      // EVERY pass (not just once at entry): a pass can be deferred onto a
      // later microtask/timer tick by the time it actually runs, during which
      // the host may have gone offline or paused — an internally-scheduled
      // continuation must never race past that.
      for (;;) {
        if (!shouldDrain()) {
          break;
        }
        const pass = await drainOnce(userId);
        if (pass.progressed) {
          onDrainPass?.({userId});
        }
        if (pass.authPaused) {
          authPaused = true;
          break;
        }
        if (pass.nextWakeAt !== undefined) {
          parkedAt = pass.nextWakeAt;
          break;
        }
        if (pass.stopReplayCall) {
          // Either every remaining queued mutation is B4-blocked (nothing
          // more can happen until resolveConflict/retryFailed — looping
          // again would spin forever on a queue that never shrinks), or a
          // halting decision with no backoff of its own fired (a plain
          // conflict nack under haltQueueOnConflict) — looping again would
          // silently defeat that halt by draining unrelated entities anyway.
          break;
        }
        // Only stop looping once nothing is queued (drain-until-empty).
        if (outbox.listQueued({userId}).length === 0) {
          break;
        }
      }
      if (authPaused) {
        if (!authPauseNotified.has(userId)) {
          authPauseNotified.add(userId);
          onAuthPause?.({userId});
        }
        return {paused: "auth"};
      }
      authPauseNotified.delete(userId);
      if (parkedAt !== undefined) {
        // Timed wake-up: arm a single setTimeout for the earliest backoff
        // across the parked queue so callers never need to poll.
        armWakeTimer(userId, Math.max(0, parkedAt - now()));
      }
      return {};
    })();
    const tracked = run.finally(() => {
      inFlightReplays.delete(userId);
      if (recheckRequested.delete(userId)) {
        void replay({userId});
      }
    });
    inFlightReplays.set(userId, tracked);
    return tracked;
  };

  const dispose = (args?: {userId?: string}): void => {
    if (args?.userId !== undefined) {
      clearWakeTimer(args.userId);
      return;
    }
    for (const userId of [...wakeTimers.keys()]) {
      clearWakeTimer(userId);
    }
  };

  const notifyReconnect = (): void => {
    batchUnsupported = false;
  };

  const retryFailed = ({entityId}: {entityId: string}): void => {
    for (const key of [...validationBlockedEntities]) {
      if (key.endsWith(`:${entityId}`)) {
        validationBlockedEntities.delete(key);
      }
    }
  };

  const getBlockedEntities = ({userId}: {userId: string}): string[] => {
    const blocked = new Set<string>();
    for (const key of validationBlockedEntities) {
      blocked.add(key);
    }
    for (const mutation of outbox.listQueued({userId})) {
      if (hasUnresolvedConflict(mutation)) {
        blocked.add(entityKey(mutation.collection, mutation.entityId));
      }
    }
    return [...blocked];
  };

  const getDrainProgress = ({
    userId,
  }: {
    userId: string;
  }): {draining: boolean; sentThisDrain: number; totalThisDrain: number} => {
    const progress = drainProgress.get(userId);
    return {
      draining: inFlightReplays.has(userId),
      sentThisDrain: progress?.sent ?? 0,
      totalThisDrain: progress?.total ?? 0,
    };
  };

  return {
    dispose,
    getBlockedEntities,
    getDrainProgress,
    notifyReconnect,
    replay,
    retryFailed,
  };
};
