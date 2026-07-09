import type {SyncDebugLog} from "../debug/debugLog";
import {writeConflict} from "../mutations/conflicts";
import type {Outbox} from "../mutations/outbox";
import type {SyncStore} from "../storage/store";
import type {OutboxMutation, SyncAck, SyncMutateRequest, SyncNack} from "../types";
import type {SendMutationResult} from "./transport";

/** Error-nack retries beyond this attempt count become terminal failures. */
export const MAX_ERROR_NACK_ATTEMPTS = 5;

/** Base delay for the error-nack exponential backoff (doubles per attempt). */
export const ERROR_NACK_BASE_BACKOFF_MS = 1_000;

export interface ReplayResult {
  /** Set when replay stopped early because the server rejected our auth. */
  paused?: "auth";
}

export interface ReplayCoordinator {
  /**
   * Drain the user's queued mutations FIFO per collection (collections drain
   * in parallel, mutations within a collection serially). A second call for
   * the same user while one is running returns the in-flight promise.
   */
  replay: (args: {userId: string}) => Promise<ReplayResult>;
}

/**
 * Bridges the durable outbox and the send channel, resolving each mutation's
 * server outcome:
 *
 * - **ack** → markAcked, clear the entity's `pendingMutationId` (when it still
 *   belongs to this mutation) and stamp the acked seq;
 * - **nack conflict** → markConflicted + record a `_conflicts` row; the
 *   entity's optimistic state stays in place until the user resolves;
 * - **nack unauthorized** → back to queued and pause replay for the user
 *   (`{paused: "auth"}`); the next replay call retries;
 * - **nack validation** → markFailed (terminal) and release the entity's
 *   `pendingMutationId` so future deltas are not blocked forever;
 * - **nack error** → back to queued with attemptCount-based exponential
 *   backoff (in-memory), terminal markFailed after
 *   {@link MAX_ERROR_NACK_ATTEMPTS} attempts;
 * - **send rejection** (timeout / network / disconnect) → back to queued and
 *   stop draining that collection until the next replay call.
 */
export const createReplayCoordinator = ({
  store,
  outbox,
  sendMutation,
  now = () => Date.now(),
  debug,
}: {
  store: SyncStore;
  outbox: Outbox;
  sendMutation: (request: SyncMutateRequest) => Promise<SendMutationResult>;
  /** Millisecond clock, injectable for deterministic backoff tests. */
  now?: () => number;
  /** Optional debug log; when present, each mutation outcome is recorded. */
  debug?: SyncDebugLog;
}): ReplayCoordinator => {
  const inFlightReplays = new Map<string, Promise<ReplayResult>>();
  /** mutationId → earliest epoch-ms the next attempt may run (error-nack backoff). */
  const retryAt = new Map<string, number>();

  const buildRequest = (mutation: OutboxMutation): SyncMutateRequest => {
    const request: SyncMutateRequest = {
      collection: mutation.collection,
      id: mutation.entityId,
      mutationId: mutation.mutationId,
      operation: mutation.operation,
    };
    if (mutation.baseVersion !== undefined) {
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

  const drainCollection = async (
    mutations: OutboxMutation[],
    state: {authPaused: boolean}
  ): Promise<void> => {
    for (const mutation of mutations) {
      if (state.authPaused) {
        return;
      }
      const nextAttemptAt = retryAt.get(mutation.mutationId);
      if (nextAttemptAt !== undefined && now() < nextAttemptAt) {
        // FIFO within a collection: a backing-off head blocks the drain rather
        // than letting later mutations overtake it.
        return;
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
      } catch {
        // Transport failure (timeout, network, disconnect): keep the mutation
        // queued and stop draining this collection until the next replay.
        outbox.markQueued({mutationId: mutation.mutationId});
        debug?.record({
          collection: mutation.collection,
          detail: {reason: "transport"},
          direction: "system",
          entityId: mutation.entityId,
          label: `retry ${mutation.collection}/${mutation.entityId} (transport)`,
          mutationId: mutation.mutationId,
          operation: mutation.operation,
          type: "retry",
        });
        return;
      }
      if (result.type === "ack") {
        handleAck(mutation, result.ack);
        continue;
      }
      const {nack} = result;
      if (nack.code === "conflict") {
        handleConflict(mutation, nack);
        continue;
      }
      if (nack.code === "unauthorized") {
        outbox.markQueued({mutationId: mutation.mutationId});
        state.authPaused = true;
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
        return;
      }
      if (nack.code === "validation") {
        handleTerminalFailure(mutation, "validation");
        continue;
      }
      // "error": transient server failure — exponential backoff, then terminal.
      const attempts =
        outbox.getMutation({mutationId: mutation.mutationId})?.attemptCount ??
        mutation.attemptCount + 1;
      if (attempts >= MAX_ERROR_NACK_ATTEMPTS) {
        handleTerminalFailure(mutation, "error");
        continue;
      }
      outbox.markQueued({mutationId: mutation.mutationId});
      const backoffMs = ERROR_NACK_BASE_BACKOFF_MS * 2 ** (attempts - 1);
      retryAt.set(mutation.mutationId, now() + backoffMs);
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
      // The backing-off mutation stays at the head of its collection's FIFO;
      // stop draining until its delay elapses.
      return;
    }
  };

  const replay = ({userId}: {userId: string}): Promise<ReplayResult> => {
    const existing = inFlightReplays.get(userId);
    if (existing) {
      return existing;
    }
    const run = (async (): Promise<ReplayResult> => {
      const byCollection = new Map<string, OutboxMutation[]>();
      for (const mutation of outbox.listQueued({userId})) {
        const list = byCollection.get(mutation.collection) ?? [];
        list.push(mutation);
        byCollection.set(mutation.collection, list);
      }
      const state = {authPaused: false};
      await Promise.all(
        [...byCollection.values()].map((mutations) => drainCollection(mutations, state))
      );
      return state.authPaused ? {paused: "auth"} : {};
    })();
    const tracked = run.finally(() => {
      inFlightReplays.delete(userId);
    });
    inFlightReplays.set(userId, tracked);
    return tracked;
  };

  return {replay};
};
