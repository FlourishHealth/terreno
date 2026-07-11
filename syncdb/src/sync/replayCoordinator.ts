import type {SyncDebugLog} from "../debug/debugLog";
import {writeConflict} from "../mutations/conflicts";
import type {Outbox} from "../mutations/outbox";
import type {SyncStore} from "../storage/store";
import type {OutboxMutation, SyncAck, SyncMutateRequest, SyncNack} from "../types";
import {AuthRequiredError} from "./httpChannel";
import type {SendMutationResult} from "./transport";

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
}

export interface CreateReplayCoordinatorArgs {
  store: SyncStore;
  outbox: Outbox;
  sendMutation: (request: SyncMutateRequest) => Promise<SendMutationResult>;
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
   * Consulted before every drain attempt — including internally-scheduled
   * ones (the armed wake-up timer and the mid-drain-enqueue recheck) that
   * bypass the caller's own call site. Lets the host gate sending on state the
   * coordinator does not itself track (simulated offline, auth pause at the
   * client level). Defaults to always-allow.
   */
  shouldDrain?: () => boolean;
}

/**
 * Bridges the durable outbox and the send channel, resolving each mutation's
 * server outcome:
 *
 * - **ack** → markAcked, clear the entity's `pendingMutationId` (when it still
 *   belongs to this mutation) and stamp the acked seq;
 * - **nack conflict** → markConflicted + record a `_conflicts` row; the
 *   entity's optimistic state stays in place until the user resolves;
 * - **nack unauthorized** / thrown `AuthRequiredError` → back to queued and
 *   pause replay for the user (`{paused: "auth"}`), consuming NO retry budget
 *   (INV-2); the next replay call (after re-auth) retries;
 * - **nack validation** → markFailed (terminal) and release the entity's
 *   `pendingMutationId` so future deltas are not blocked forever;
 * - **nack error** → back to queued with jittered exponential backoff against
 *   the dedicated `errorNackCount` budget, terminal markFailed after
 *   {@link MAX_ERROR_NACK_ATTEMPTS} attempts;
 * - **send rejection** (timeout / network / disconnect) → back to queued with
 *   unlimited jittered exponential backoff (never terminal, never burns the
 *   error-nack budget) and the drain parks until the backoff elapses.
 *
 * The drain is a SINGLE global FIFO over `enqueueOrder` (INV-1) — no more
 * per-collection parallelism. `replay()` keeps re-running drain passes until
 * the queue is empty or parked; when it parks on a backoff, a single
 * `setTimeout` wakes the next drain automatically so callers never need to
 * poll.
 */
export const createReplayCoordinator = ({
  store,
  outbox,
  sendMutation,
  now = () => Date.now(),
  random = () => Math.random(),
  debug,
  setTimeoutFn = (handler, ms) => setTimeout(handler, ms),
  clearTimeoutFn = (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  onDrainPass,
  onAuthPause,
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

  /** Outcome of one drain pass over the full FIFO queue. */
  interface DrainPassResult {
    authPaused: boolean;
    /** Earliest backoff wake-up across every parked mutation this pass, if any. */
    nextWakeAt?: number;
    /** True when at least one mutation acked this pass (progress signal for pruning). */
    progressed: boolean;
  }

  const drainOnce = async (userId: string): Promise<DrainPassResult> => {
    const mutations = outbox.listQueued({userId});
    let progressed = false;
    let nextWakeAt: number | undefined;

    for (const mutation of mutations) {
      const nextAttemptAt = retryAt.get(mutation.mutationId);
      if (nextAttemptAt !== undefined && now() < nextAttemptAt) {
        // INV-1: a backing-off head blocks the ENTIRE global drain rather than
        // letting later mutations (in this or another collection) overtake it.
        nextWakeAt = nextWakeAt === undefined ? nextAttemptAt : Math.min(nextWakeAt, nextAttemptAt);
        return {authPaused: false, nextWakeAt, progressed};
      }
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
          return {authPaused: true, progressed};
        }
        // Transport failure (timeout, network, disconnect): unlimited retries
        // with jittered capped backoff, tracked separately from the
        // error-nack budget.
        outbox.markQueued({mutationId: mutation.mutationId});
        const attempt = (transportFailures.get(mutation.mutationId) ?? 0) + 1;
        transportFailures.set(mutation.mutationId, attempt);
        const backoffMs = jitteredBackoff(attempt, TRANSPORT_FAILURE_BASE_BACKOFF_MS);
        const wakeAt = now() + backoffMs;
        retryAt.set(mutation.mutationId, wakeAt);
        nextWakeAt = nextWakeAt === undefined ? wakeAt : Math.min(nextWakeAt, wakeAt);
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
        return {authPaused: false, nextWakeAt, progressed};
      }
      if (result.type === "ack") {
        handleAck(mutation, result.ack);
        progressed = true;
        continue;
      }
      const {nack} = result;
      if (nack.code === "conflict") {
        handleConflict(mutation, nack);
        continue;
      }
      if (nack.code === "unauthorized") {
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
        return {authPaused: true, progressed};
      }
      if (nack.code === "validation") {
        handleTerminalFailure(mutation, "validation");
        continue;
      }
      // "error": transient server failure — jittered exponential backoff
      // against the dedicated errorNackCount budget, then terminal.
      const beforeCount =
        outbox.getMutation({mutationId: mutation.mutationId})?.errorNackCount ?? 0;
      const attempts = beforeCount + 1;
      if (attempts >= MAX_ERROR_NACK_ATTEMPTS) {
        handleTerminalFailure(mutation, "error");
        continue;
      }
      outbox.markQueuedAfterErrorNack({mutationId: mutation.mutationId});
      const backoffMs = jitteredBackoff(attempts, ERROR_NACK_BASE_BACKOFF_MS);
      const wakeAt = now() + backoffMs;
      retryAt.set(mutation.mutationId, wakeAt);
      nextWakeAt = nextWakeAt === undefined ? wakeAt : Math.min(nextWakeAt, wakeAt);
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
      // INV-1: the backing-off mutation stays at the head of the global FIFO;
      // stop draining until its delay elapses.
      return {authPaused: false, nextWakeAt, progressed};
    }
    return {authPaused: false, progressed};
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

  return {dispose, replay};
};
