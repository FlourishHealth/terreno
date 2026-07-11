import {describe, expect, it} from "bun:test";

import {getConflict} from "../mutations/conflicts";
import {createOutbox, type Outbox} from "../mutations/outbox";
import {createSyncStore, type SyncStore} from "../storage/store";
import type {SyncMutateRequest} from "../types";
import {createFakeTransport, type FakeTransport} from "./fakeTransport";
import {AuthRequiredError} from "./httpChannel";
import {
  type CreateReplayCoordinatorArgs,
  createReplayCoordinator,
  ERROR_NACK_BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
  MAX_ERROR_NACK_ATTEMPTS,
  type ReplayCoordinator,
} from "./replayCoordinator";

const USER = "user-1";

interface Harness {
  store: SyncStore;
  outbox: Outbox;
  transport: FakeTransport;
  coordinator: ReplayCoordinator;
  clock: {value: number};
}

const makeHarness = (): Harness => {
  const store = createSyncStore({collections: ["notes", "todos"]});
  const outbox = createOutbox({store});
  const transport = createFakeTransport();
  const clock = {value: 1_000_000};
  const coordinator = createReplayCoordinator({
    now: () => clock.value,
    outbox,
    sendMutation: transport.sendMutation,
    store,
  });
  return {clock, coordinator, outbox, store, transport};
};

/** A fake, controllable timer queue: setTimeoutFn/clearTimeoutFn injectable into the coordinator. */
interface FakeTimers {
  /** Fire every timer whose delay has elapsed at the current clock value, in schedule order. */
  flush: () => void;
  /** Number of currently armed (not yet fired/cleared) timers. */
  armedCount: () => number;
}

const makeFakeTimers = (clock: {
  value: number;
}): {timers: FakeTimers} & Pick<CreateReplayCoordinatorArgs, "setTimeoutFn" | "clearTimeoutFn"> => {
  interface Entry {
    id: number;
    handler: () => void;
    dueAt: number;
    cleared: boolean;
  }
  const entries = new Map<number, Entry>();
  let nextId = 1;
  const setTimeoutFn = (handler: () => void, ms: number): unknown => {
    const id = nextId++;
    entries.set(id, {cleared: false, dueAt: clock.value + ms, handler, id});
    return id;
  };
  const clearTimeoutFn = (handle: unknown): void => {
    const entry = entries.get(handle as number);
    if (entry) {
      entry.cleared = true;
      entries.delete(handle as number);
    }
  };
  const flush = (): void => {
    const due = [...entries.values()]
      .filter((entry) => !entry.cleared && entry.dueAt <= clock.value)
      .sort((a, b) => a.dueAt - b.dueAt || a.id - b.id);
    for (const entry of due) {
      if (entries.get(entry.id)?.cleared) {
        continue;
      }
      entries.delete(entry.id);
      entry.handler();
    }
  };
  return {
    clearTimeoutFn,
    setTimeoutFn,
    timers: {
      armedCount: () => entries.size,
      flush,
    },
  };
};

/** Enqueue a mutation plus its optimistic entity state, mirroring client.mutate. */
const enqueue = (
  harness: Harness,
  {
    collection = "todos",
    entityId,
    mutationId,
    data = {title: entityId},
    baseVersion,
    operation = "create" as const,
    userId = USER,
  }: {
    collection?: string;
    entityId: string;
    mutationId: string;
    data?: Record<string, unknown>;
    baseVersion?: number;
    operation?: "create" | "update" | "delete";
    userId?: string;
  }
): void => {
  harness.store.upsertEntity({
    collection,
    data,
    id: entityId,
    pendingMutationId: mutationId,
    seq: baseVersion,
  });
  harness.outbox.enqueue({
    args: data,
    baseVersion,
    collection,
    entityId,
    mutationId,
    operation,
    userId,
  });
};

describe("createReplayCoordinator", () => {
  it("acks finalize the mutation, clear pendingMutationId, and stamp the server seq", async () => {
    const harness = makeHarness();
    enqueue(harness, {entityId: "t1", mutationId: "m1"});
    harness.transport.respondWithAck({seq: 42});

    const result = await harness.coordinator.replay({userId: USER});
    expect(result).toEqual({});
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("acked");
    const entity = harness.store.getEntity({collection: "todos", id: "t1"});
    expect(entity?.pendingMutationId).toBeUndefined();
    expect(entity?.seq).toBe(42);
    expect(entity?.data).toEqual({title: "t1"});
  });

  it("does not clear a pendingMutationId owned by a newer mutation", async () => {
    const harness = makeHarness();
    enqueue(harness, {entityId: "t1", mutationId: "m1"});
    // A second optimistic edit re-protects the entity before m1 resolves.
    harness.store.upsertEntity({
      collection: "todos",
      data: {title: "newer"},
      id: "t1",
      pendingMutationId: "m2",
    });
    harness.transport.respondWithAck({seq: 5});

    await harness.coordinator.replay({userId: USER});
    const entity = harness.store.getEntity({collection: "todos", id: "t1"});
    expect(entity?.pendingMutationId).toBe("m2");
    expect(entity?.seq).toBe(5);
  });

  it("sends mutations with parsed data, baseVersion, and no data for deletes", async () => {
    const harness = makeHarness();
    enqueue(harness, {
      baseVersion: 3,
      data: {title: "hello"},
      entityId: "t1",
      mutationId: "m1",
      operation: "update",
    });
    enqueue(harness, {baseVersion: 4, entityId: "t2", mutationId: "m2", operation: "delete"});

    await harness.coordinator.replay({userId: USER});
    const [first, second] = harness.transport.sentMutations;
    expect(first).toEqual({
      baseVersion: 3,
      collection: "todos",
      data: {title: "hello"},
      id: "t1",
      mutationId: "m1",
      operation: "update",
    });
    expect(second).toEqual({
      baseVersion: 4,
      collection: "todos",
      id: "t2",
      mutationId: "m2",
      operation: "delete",
    });
  });

  describe("send-time baseVersion refresh (A2)", () => {
    it("chains a create + update to the same entity through one queue with no self-conflict", async () => {
      const harness = makeHarness();
      // create: no baseVersion (new entity).
      enqueue(harness, {
        data: {title: "v1"},
        entityId: "t1",
        mutationId: "m1",
        operation: "create",
      });
      // update enqueued offline BEFORE the create acked: captured baseVersion
      // is still the stale 0/undefined floor.
      harness.store.upsertEntity({collection: "todos", data: {title: "v2"}, id: "t1"});
      harness.outbox.enqueue({
        args: {title: "v2"},
        collection: "todos",
        entityId: "t1",
        mutationId: "m2",
        operation: "update",
        userId: USER,
      });

      await harness.coordinator.replay({userId: USER});
      const [createReq, updateReq] = harness.transport.sentMutations;
      expect(createReq.baseVersion).toBeUndefined();
      // The create's ack (seq 1) stamped the entity's seq before the update's
      // request was built — the update carries the FRESH seq, not the stale
      // enqueue-time floor, so it never manufactures a conflict.
      expect(updateReq.baseVersion).toBe(1);
      expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("acked");
      expect(harness.outbox.getMutation({mutationId: "m2"})?.status).toBe("acked");
    });

    it("chains update + update through one queue: the second request carries the first's acked seq", async () => {
      const harness = makeHarness();
      harness.store.upsertEntity({collection: "todos", data: {title: "v0"}, id: "t1", seq: 5});
      harness.outbox.enqueue({
        args: {title: "v1"},
        baseVersion: 5,
        collection: "todos",
        entityId: "t1",
        mutationId: "m1",
        operation: "update",
        userId: USER,
      });
      harness.outbox.enqueue({
        // Enqueued while m1 is still unacked: same stale baseVersion captured.
        args: {title: "v2"},
        baseVersion: 5,
        collection: "todos",
        entityId: "t1",
        mutationId: "m2",
        operation: "update",
        userId: USER,
      });
      harness.transport.respondWithAck({seq: 6});

      await harness.coordinator.replay({userId: USER});
      const [firstReq, secondReq] = harness.transport.sentMutations;
      expect(firstReq.baseVersion).toBe(5);
      // m1's ack (seq 6) stamped the entity's seq before m2's request was
      // built — m2 carries that fresh seq, not the stale enqueue-time floor.
      expect(secondReq.baseVersion).toBe(6);
      expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("acked");
      expect(harness.outbox.getMutation({mutationId: "m2"})?.status).toBe("acked");
    });

    it("never sends a baseVersion lower than the one stored at enqueue time (floor)", async () => {
      const harness = makeHarness();
      // The entity's live seq (2) is BELOW the stored baseVersion (5) — e.g. a
      // stale local write raced a delta application. The stored value is the
      // floor and must win.
      harness.store.upsertEntity({collection: "todos", data: {title: "v1"}, id: "t1", seq: 2});
      harness.outbox.enqueue({
        args: {title: "v1"},
        baseVersion: 5,
        collection: "todos",
        entityId: "t1",
        mutationId: "m1",
        operation: "update",
        userId: USER,
      });

      await harness.coordinator.replay({userId: USER});
      expect(harness.transport.sentMutations[0]?.baseVersion).toBe(5);
    });

    it("regression: a genuinely stale base (server changed underneath) still conflicts", async () => {
      const harness = makeHarness();
      enqueue(harness, {
        baseVersion: 2,
        data: {title: "local"},
        entityId: "t1",
        mutationId: "m1",
        operation: "update",
      });
      harness.transport.respondWithNack({
        code: "conflict",
        serverDoc: {title: "server wins"},
        serverSeq: 9,
      });

      await harness.coordinator.replay({userId: USER});
      expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("conflicted");
      expect(getConflict({mutationId: "m1", store: harness.store})?.serverSeq).toBe(9);
    });
  });

  it("drains FIFO within a collection", async () => {
    const harness = makeHarness();
    enqueue(harness, {entityId: "t1", mutationId: "m1"});
    enqueue(harness, {entityId: "t2", mutationId: "m2"});
    enqueue(harness, {entityId: "t3", mutationId: "m3"});

    await harness.coordinator.replay({userId: USER});
    expect(harness.transport.sentMutations.map((m) => m.mutationId)).toEqual(["m1", "m2", "m3"]);
  });

  it("a transport rejection halts the ENTIRE global drain (INV-1), not just its collection", async () => {
    const harness = makeHarness();
    enqueue(harness, {entityId: "t1", mutationId: "m1"});
    enqueue(harness, {entityId: "t2", mutationId: "m2"});
    enqueue(harness, {collection: "notes", entityId: "n1", mutationId: "m3"});
    harness.transport.setDefaultResponder((request) => {
      if (request.collection === "todos") {
        throw new Error("timeout");
      }
      return {ack: {id: request.id ?? "", mutationId: request.mutationId, seq: 1}, type: "ack"};
    });

    await harness.coordinator.replay({userId: USER});
    // m1 (head of the global FIFO) failed to send and went back to queued;
    // the drain stops the line — m2 AND m3 (a different collection) are never
    // attempted, even though m3's transport would have acked it.
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("queued");
    expect(harness.outbox.getMutation({mutationId: "m2"})?.status).toBe("queued");
    expect(harness.outbox.getMutation({mutationId: "m3"})?.status).toBe("queued");
    expect(harness.transport.sentMutations.map((m) => m.mutationId)).toEqual(["m1"]);

    // The next replay resumes the whole queue once the transport recovers and
    // the jittered backoff has elapsed.
    harness.transport.setDefaultResponder();
    harness.clock.value += ERROR_NACK_BASE_BACKOFF_MS * 30;
    await harness.coordinator.replay({userId: USER});
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("acked");
    expect(harness.outbox.getMutation({mutationId: "m2"})?.status).toBe("acked");
    expect(harness.outbox.getMutation({mutationId: "m3"})?.status).toBe("acked");
  });

  it("conflict nacks record a _conflicts row and leave the optimistic entity in place", async () => {
    const harness = makeHarness();
    enqueue(harness, {
      baseVersion: 2,
      data: {title: "local"},
      entityId: "t1",
      mutationId: "m1",
      operation: "update",
    });
    harness.transport.respondWithNack({
      code: "conflict",
      serverDoc: {title: "server"},
      serverSeq: 9,
    });

    await harness.coordinator.replay({userId: USER});
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("conflicted");
    expect(getConflict({mutationId: "m1", store: harness.store})).toEqual({
      collection: "todos",
      dismissed: false,
      entityId: "t1",
      localData: JSON.stringify({title: "local"}),
      mutationId: "m1",
      serverData: JSON.stringify({title: "server"}),
      serverSeq: 9,
    });
    const entity = harness.store.getEntity({collection: "todos", id: "t1"});
    expect(entity?.data).toEqual({title: "local"});
    expect(entity?.pendingMutationId).toBe("m1");
  });

  it("unauthorized nacks requeue, pause replay for the user, and resume on the next call", async () => {
    const harness = makeHarness();
    enqueue(harness, {entityId: "t1", mutationId: "m1"});
    enqueue(harness, {entityId: "t2", mutationId: "m2"});
    enqueue(harness, {collection: "notes", entityId: "n1", mutationId: "m3"});
    harness.transport.setDefaultResponder((request) => ({
      nack: {code: "unauthorized", mutationId: request.mutationId},
      type: "nack",
    }));

    const result = await harness.coordinator.replay({userId: USER});
    expect(result).toEqual({paused: "auth"});
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("queued");
    expect(harness.outbox.getMutation({mutationId: "m2"})?.status).toBe("queued");

    // Resumable: after auth is restored the next replay drains everything.
    harness.transport.setDefaultResponder();
    const resumed = await harness.coordinator.replay({userId: USER});
    expect(resumed).toEqual({});
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("acked");
    expect(harness.outbox.getMutation({mutationId: "m2"})?.status).toBe("acked");
    expect(harness.outbox.getMutation({mutationId: "m3"})?.status).toBe("acked");
  });

  it("AuthRequiredError thrown by the send channel (A4) is treated exactly like an unauthorized nack: requeue, pause, zero budget burn", async () => {
    const harness = makeHarness();
    enqueue(harness, {entityId: "t1", mutationId: "m1"});
    enqueue(harness, {entityId: "t2", mutationId: "m2"});
    harness.transport.respondWith(() => {
      throw new AuthRequiredError();
    });

    const result = await harness.coordinator.replay({userId: USER});
    expect(result).toEqual({paused: "auth"});
    const mutation = harness.outbox.getMutation({mutationId: "m1"});
    expect(mutation?.status).toBe("queued");
    // No budget consumed at all: neither the diagnostic attemptCount (beyond
    // the single send attempt already counted by markInFlight) nor the
    // error-nack terminality counter.
    expect(mutation?.errorNackCount).toBe(0);
    expect(harness.outbox.getMutation({mutationId: "m2"})?.status).toBe("queued");

    // Resumable exactly like an unauthorized nack.
    harness.transport.setDefaultResponder();
    const resumed = await harness.coordinator.replay({userId: USER});
    expect(resumed).toEqual({});
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("acked");
    expect(harness.outbox.getMutation({mutationId: "m2"})?.status).toBe("acked");
  });

  it("validation nacks are terminal failures that release the entity", async () => {
    const harness = makeHarness();
    enqueue(harness, {entityId: "t1", mutationId: "m1"});
    harness.transport.respondWithNack({code: "validation", message: "title required"});

    await harness.coordinator.replay({userId: USER});
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("failed");
    // pendingMutationId is released so future server deltas can apply.
    expect(
      harness.store.getEntity({collection: "todos", id: "t1"})?.pendingMutationId
    ).toBeUndefined();
  });

  it("error nacks requeue with exponential backoff and block the collection head", async () => {
    const harness = makeHarness();
    enqueue(harness, {entityId: "t1", mutationId: "m1"});
    enqueue(harness, {entityId: "t2", mutationId: "m2"});
    harness.transport.respondWithNack({code: "error"});

    await harness.coordinator.replay({userId: USER});
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("queued");
    // FIFO: m2 is not sent while the head is backing off.
    expect(harness.transport.sentMutations.map((m) => m.mutationId)).toEqual(["m1"]);

    // Within the backoff window nothing is retried.
    await harness.coordinator.replay({userId: USER});
    expect(harness.transport.sentMutations).toHaveLength(1);

    // After the first backoff delay elapses, the head retries and the queue drains.
    harness.clock.value += ERROR_NACK_BASE_BACKOFF_MS;
    await harness.coordinator.replay({userId: USER});
    expect(harness.transport.sentMutations.map((m) => m.mutationId)).toEqual(["m1", "m1", "m2"]);
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("acked");
    expect(harness.outbox.getMutation({mutationId: "m2"})?.status).toBe("acked");
  });

  it(`marks failed after ${MAX_ERROR_NACK_ATTEMPTS} error-nack attempts`, async () => {
    const harness = makeHarness();
    enqueue(harness, {entityId: "t1", mutationId: "m1"});
    harness.transport.setDefaultResponder((request) => ({
      nack: {code: "error", mutationId: request.mutationId},
      type: "nack",
    }));

    for (let attempt = 1; attempt <= MAX_ERROR_NACK_ATTEMPTS; attempt += 1) {
      await harness.coordinator.replay({userId: USER});
      // Jump past any backoff so the next attempt is eligible.
      harness.clock.value += ERROR_NACK_BASE_BACKOFF_MS * 2 ** attempt;
    }
    expect(harness.transport.sentMutations).toHaveLength(MAX_ERROR_NACK_ATTEMPTS);
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("failed");
    expect(
      harness.store.getEntity({collection: "todos", id: "t1"})?.pendingMutationId
    ).toBeUndefined();

    // Terminal: further replays never resend it.
    harness.clock.value += ERROR_NACK_BASE_BACKOFF_MS * 100;
    await harness.coordinator.replay({userId: USER});
    expect(harness.transport.sentMutations).toHaveLength(MAX_ERROR_NACK_ATTEMPTS);
  });

  it("a concurrent replay for the same user returns the in-flight promise", async () => {
    const harness = makeHarness();
    enqueue(harness, {entityId: "t1", mutationId: "m1"});
    let release: (() => void) | undefined;
    harness.transport.respondWith(async (request: SyncMutateRequest) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return {ack: {id: request.id ?? "", mutationId: request.mutationId, seq: 1}, type: "ack"};
    });

    const first = harness.coordinator.replay({userId: USER});
    const second = harness.coordinator.replay({userId: USER});
    expect(second).toBe(first);
    release?.();
    await first;
    expect(harness.transport.sentMutations).toHaveLength(1);

    // After completion a new replay starts fresh.
    const third = harness.coordinator.replay({userId: USER});
    expect(third).not.toBe(first);
    await third;
  });

  it("only replays mutations belonging to the requested user", async () => {
    const harness = makeHarness();
    enqueue(harness, {entityId: "t1", mutationId: "m1", userId: "someone-else"});
    enqueue(harness, {entityId: "t2", mutationId: "m2"});

    await harness.coordinator.replay({userId: USER});
    expect(harness.transport.sentMutations.map((m) => m.mutationId)).toEqual(["m2"]);
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("queued");
  });

  it("tolerates unparseable stored args by sending empty data", async () => {
    const harness = makeHarness();
    harness.store.upsertEntity({
      collection: "todos",
      data: null,
      id: "t1",
      pendingMutationId: "m1",
    });
    harness.outbox.enqueue({
      args: {},
      collection: "todos",
      entityId: "t1",
      mutationId: "m1",
      operation: "create",
      userId: USER,
    });
    harness.store.raw.setCell("_outbox", "m1", "args", "{not json");

    await harness.coordinator.replay({userId: USER});
    expect(harness.transport.sentMutations[0]?.data).toEqual({});
  });

  describe("real scheduler: drain-until-empty + timed wake-ups + jittered backoff (A3)", () => {
    it("sends a mutation enqueued during an active drain, within the same replay() call", async () => {
      const store = createSyncStore({collections: ["todos"]});
      const outbox = createOutbox({store});
      const transport = createFakeTransport();
      let armedSecond = false;
      transport.respondWith(async (request) => {
        // Enqueue m2 WHILE m1's send is in flight — before the drain loop's
        // "is the queue now empty" recheck runs.
        if (!armedSecond) {
          armedSecond = true;
          outbox.enqueue({
            args: {title: "t2"},
            collection: "todos",
            entityId: "t2",
            mutationId: "m2",
            operation: "create",
            userId: USER,
          });
        }
        return {ack: {id: request.id ?? "", mutationId: request.mutationId, seq: 1}, type: "ack"};
      });
      const coordinator = createReplayCoordinator({
        outbox,
        sendMutation: transport.sendMutation,
        store,
      });
      outbox.enqueue({
        args: {title: "t1"},
        collection: "todos",
        entityId: "t1",
        mutationId: "m1",
        operation: "create",
        userId: USER,
      });

      await coordinator.replay({userId: USER});
      expect(transport.sentMutations.map((m) => m.mutationId)).toEqual(["m1", "m2"]);
      expect(outbox.getMutation({mutationId: "m2"})?.status).toBe("acked");
    });

    it("an error-nack backoff elapsing fires the retry from the armed timer alone (no external trigger)", async () => {
      const store = createSyncStore({collections: ["todos"]});
      const outbox = createOutbox({store});
      const transport = createFakeTransport();
      const clock = {value: 1_000_000};
      const {timers, ...timerArgs} = makeFakeTimers(clock);
      const coordinator = createReplayCoordinator({
        ...timerArgs,
        now: () => clock.value,
        outbox,
        random: () => 0.999999, // near-max jitter for a deterministic wake delay
        sendMutation: transport.sendMutation,
        store,
      });
      outbox.enqueue({
        args: {title: "t1"},
        collection: "todos",
        entityId: "t1",
        mutationId: "m1",
        operation: "create",
        userId: USER,
      });
      transport.respondWithNack({code: "error"});

      await coordinator.replay({userId: USER});
      expect(outbox.getMutation({mutationId: "m1"})?.status).toBe("queued");
      expect(transport.sentMutations).toHaveLength(1);
      expect(timers.armedCount()).toBe(1);

      // Advance the clock past the backoff and fire the armed timer directly —
      // no replay()/replayOutbox() call from the test.
      clock.value += ERROR_NACK_BASE_BACKOFF_MS;
      timers.flush();
      await Promise.resolve();
      await Promise.resolve();
      expect(transport.sentMutations.map((m) => m.mutationId)).toEqual(["m1", "m1"]);
      expect(outbox.getMutation({mutationId: "m1"})?.status).toBe("acked");
    });

    it("transport failures get unlimited retries (never terminal) and don't burn the error-nack budget; a subsequent error-nack budget starts at 1", async () => {
      const harness = makeHarness();
      enqueue(harness, {entityId: "t1", mutationId: "m1"});
      harness.transport.setDefaultResponder(() => {
        throw new Error("network down");
      });

      // Ten transport failures — still queued, never terminal, attemptCount
      // climbs but errorNackCount (the terminality budget) stays at 0.
      for (let i = 0; i < 10; i += 1) {
        await harness.coordinator.replay({userId: USER});
        harness.clock.value += MAX_BACKOFF_MS;
      }
      const afterTransportFailures = harness.outbox.getMutation({mutationId: "m1"});
      expect(afterTransportFailures?.status).toBe("queued");
      expect(afterTransportFailures?.errorNackCount).toBe(0);
      expect(afterTransportFailures?.attemptCount).toBe(10);

      // Now the server responds with a real error-nack: its budget starts at 1,
      // not at 10 (proving the two counters are tracked separately).
      harness.transport.setDefaultResponder((request) => ({
        nack: {code: "error", mutationId: request.mutationId},
        type: "nack",
      }));
      await harness.coordinator.replay({userId: USER});
      expect(harness.outbox.getMutation({mutationId: "m1"})?.errorNackCount).toBe(1);
    });

    it("jitter: two backoffs for the same attempt differ under an injected seeded random source", async () => {
      const seeds = [0.1, 0.9];
      let call = 0;
      const transport = createFakeTransport();
      const clock = {value: 1_000_000};
      const delays: number[] = [];

      // A fresh store/outbox/coordinator per mutation isolates each one's
      // "attempt 1" backoff so both draw from the seeded random source below.
      for (const id of ["m1", "m2"]) {
        const store = createSyncStore({collections: ["todos"]});
        const outbox = createOutbox({store});
        const coordinator = createReplayCoordinator({
          now: () => clock.value,
          outbox,
          random: () => seeds[call++] ?? 0.5,
          sendMutation: transport.sendMutation,
          setTimeoutFn: (_handler, ms) => {
            delays.push(ms);
            return 0;
          },
          store,
        });
        outbox.enqueue({
          args: {},
          collection: "todos",
          entityId: id,
          mutationId: id,
          operation: "create",
          userId: USER,
        });
        transport.respondWithNack({code: "error"});
        await coordinator.replay({userId: USER});
      }
      expect(delays).toHaveLength(2);
      expect(delays[0]).not.toBe(delays[1]);
    });

    it("global order: mutations across two collections replay strictly in enqueue order", async () => {
      const harness = makeHarness();
      enqueue(harness, {collection: "todos", entityId: "t1", mutationId: "m1"});
      enqueue(harness, {collection: "notes", entityId: "n1", mutationId: "m2"});
      enqueue(harness, {collection: "todos", entityId: "t2", mutationId: "m3"});
      enqueue(harness, {collection: "notes", entityId: "n2", mutationId: "m4"});

      await harness.coordinator.replay({userId: USER});
      expect(harness.transport.sentMutations.map((m) => m.mutationId)).toEqual([
        "m1",
        "m2",
        "m3",
        "m4",
      ]);
    });

    it("dispose() clears armed timers so nothing sends after stop", async () => {
      const store = createSyncStore({collections: ["todos"]});
      const outbox = createOutbox({store});
      const transport = createFakeTransport();
      const clock = {value: 1_000_000};
      const {timers, ...timerArgs} = makeFakeTimers(clock);
      const coordinator = createReplayCoordinator({
        ...timerArgs,
        now: () => clock.value,
        outbox,
        sendMutation: transport.sendMutation,
        store,
      });
      outbox.enqueue({
        args: {},
        collection: "todos",
        entityId: "t1",
        mutationId: "m1",
        operation: "create",
        userId: USER,
      });
      transport.respondWithNack({code: "error"});

      await coordinator.replay({userId: USER});
      expect(timers.armedCount()).toBe(1);

      coordinator.dispose({userId: USER});
      expect(timers.armedCount()).toBe(0);

      // Even if the clock advances past the backoff, nothing fires — the
      // timer was cleared, not just superseded.
      clock.value += ERROR_NACK_BASE_BACKOFF_MS * 10;
      timers.flush();
      await Promise.resolve();
      expect(transport.sentMutations).toHaveLength(1);
    });

    it("skips the debug-only listQueued scan when debug logging is disabled", async () => {
      const harness = makeHarness();
      expect(harness.coordinator).toBeDefined();
      // No debug log was configured for this harness; replay must not throw or
      // require one — the debug-only scan path is conditional on its presence.
      await harness.coordinator.replay({userId: USER});
    });
  });
});
