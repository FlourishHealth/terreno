import {describe, expect, it} from "bun:test";

import {getConflict} from "../mutations/conflicts";
import {createOutbox, type Outbox} from "../mutations/outbox";
import {createSyncStore, type SyncStore} from "../storage/store";
import type {SyncMutateRequest} from "../types";
import {createFakeTransport, type FakeTransport} from "./fakeTransport";
import {
  createReplayCoordinator,
  ERROR_NACK_BASE_BACKOFF_MS,
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

  it("drains FIFO within a collection", async () => {
    const harness = makeHarness();
    enqueue(harness, {entityId: "t1", mutationId: "m1"});
    enqueue(harness, {entityId: "t2", mutationId: "m2"});
    enqueue(harness, {entityId: "t3", mutationId: "m3"});

    await harness.coordinator.replay({userId: USER});
    expect(harness.transport.sentMutations.map((m) => m.mutationId)).toEqual(["m1", "m2", "m3"]);
  });

  it("a transport rejection stops one collection without blocking the other", async () => {
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
    // todos: m1 failed to send and went back to queued; m2 never attempted.
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("queued");
    expect(harness.outbox.getMutation({mutationId: "m2"})?.status).toBe("queued");
    expect(harness.transport.sentMutations.map((m) => m.mutationId)).not.toContain("m2");
    // notes drained independently.
    expect(harness.outbox.getMutation({mutationId: "m3"})?.status).toBe("acked");

    // The next replay resumes the stopped collection.
    harness.transport.setDefaultResponder();
    await harness.coordinator.replay({userId: USER});
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("acked");
    expect(harness.outbox.getMutation({mutationId: "m2"})?.status).toBe("acked");
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
});
