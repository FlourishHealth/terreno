import {describe, expect, it} from "bun:test";

import {createSyncStore} from "../storage/store";
import {createOutbox} from "./outbox";

const makeOutbox = () => createOutbox({store: createSyncStore().raw});

describe("createOutbox", () => {
  it("enqueues a queued mutation with a generated id and zero attempts", () => {
    const outbox = makeOutbox();
    const mutation = outbox.enqueue({
      args: {title: "Buy milk"},
      collection: "todos",
      operation: "create",
    });

    expect(mutation.mutationId).toBeTruthy();
    expect(mutation.status).toBe("queued");
    expect(mutation.attemptCount).toBe(0);
    expect(mutation.args).toEqual({title: "Buy milk"});
    expect(outbox.count()).toBe(1);
  });

  it("lists mutations in FIFO (createdAt) order and filters by status", () => {
    const outbox = makeOutbox();
    outbox.enqueue({
      args: {n: 2},
      collection: "todos",
      createdAt: "2026-01-01T00:00:02.000Z",
      mutationId: "m2",
      operation: "create",
    });
    outbox.enqueue({
      args: {n: 1},
      collection: "todos",
      createdAt: "2026-01-01T00:00:01.000Z",
      mutationId: "m1",
      operation: "create",
    });

    expect(outbox.list().map((m) => m.mutationId)).toEqual(["m1", "m2"]);

    outbox.markInFlight({mutationId: "m1"});
    expect(outbox.list({status: "queued"}).map((m) => m.mutationId)).toEqual(["m2"]);
    expect(outbox.count({status: "inFlight"})).toBe(1);
  });

  it("transitions queued -> inFlight incrementing attempts and stamping lastAttemptAt", () => {
    const outbox = makeOutbox();
    outbox.enqueue({args: {}, collection: "todos", mutationId: "m1", operation: "create"});

    outbox.markInFlight({mutationId: "m1"});
    const mutation = outbox.get({mutationId: "m1"});
    expect(mutation?.status).toBe("inFlight");
    expect(mutation?.attemptCount).toBe(1);
    expect(mutation?.lastAttemptAt).toBeTruthy();
  });

  it("throws when marking a non-queued mutation in flight", () => {
    const outbox = makeOutbox();
    outbox.enqueue({args: {}, collection: "todos", mutationId: "m1", operation: "create"});
    outbox.markInFlight({mutationId: "m1"});

    expect(() => outbox.markInFlight({mutationId: "m1"})).toThrow();
    expect(() => outbox.markInFlight({mutationId: "missing"})).toThrow();
  });

  it("ack removes the mutation from the outbox", () => {
    const outbox = makeOutbox();
    outbox.enqueue({args: {}, collection: "todos", mutationId: "m1", operation: "create"});
    outbox.markInFlight({mutationId: "m1"});
    outbox.markAcked({mutationId: "m1"});

    expect(outbox.get({mutationId: "m1"})).toBeUndefined();
    expect(outbox.count()).toBe(0);
  });

  it("nack marks conflicted, and requeue allows retry", () => {
    const outbox = makeOutbox();
    outbox.enqueue({args: {}, collection: "todos", mutationId: "m1", operation: "update"});
    outbox.markInFlight({mutationId: "m1"});
    outbox.markConflicted({mutationId: "m1"});
    expect(outbox.get({mutationId: "m1"})?.status).toBe("conflicted");

    outbox.requeue({mutationId: "m1"});
    expect(outbox.get({mutationId: "m1"})?.status).toBe("queued");
  });

  it("marks failed from inFlight", () => {
    const outbox = makeOutbox();
    outbox.enqueue({args: {}, collection: "todos", mutationId: "m1", operation: "update"});
    outbox.markInFlight({mutationId: "m1"});
    outbox.markFailed({mutationId: "m1"});
    expect(outbox.get({mutationId: "m1"})?.status).toBe("failed");
  });

  it("clears mutations belonging to other users for replay isolation", () => {
    const outbox = makeOutbox();
    outbox.enqueue({
      args: {},
      collection: "todos",
      mutationId: "userA",
      operation: "create",
      userId: "A",
    });
    outbox.enqueue({
      args: {},
      collection: "todos",
      mutationId: "userB",
      operation: "create",
      userId: "B",
    });

    outbox.clearForOtherUsers({currentUserId: "B"});
    expect(outbox.get({mutationId: "userA"})).toBeUndefined();
    expect(outbox.get({mutationId: "userB"})).toBeTruthy();
  });

  it("clears all mutations", () => {
    const outbox = makeOutbox();
    outbox.enqueue({args: {}, collection: "todos", mutationId: "m1", operation: "create"});
    outbox.clear();
    expect(outbox.count()).toBe(0);
  });

  it("removes a specific mutation and no-ops for a missing id", () => {
    const outbox = makeOutbox();
    outbox.enqueue({args: {}, collection: "todos", mutationId: "m1", operation: "create"});

    outbox.remove({mutationId: "m1"});
    expect(outbox.get({mutationId: "m1"})).toBeUndefined();
    expect(() => outbox.remove({mutationId: "missing"})).not.toThrow();
  });

  it("rejects invalid lifecycle transitions", () => {
    const outbox = makeOutbox();
    outbox.enqueue({args: {}, collection: "todos", mutationId: "m1", operation: "update"});

    // queued cannot go straight to conflicted/failed/acked, and cannot requeue.
    expect(() => outbox.markConflicted({mutationId: "m1"})).toThrow();
    expect(() => outbox.markFailed({mutationId: "m1"})).toThrow();
    expect(() => outbox.markAcked({mutationId: "m1"})).toThrow();
    expect(() => outbox.requeue({mutationId: "m1"})).toThrow();

    // inFlight cannot requeue (only conflicted/failed can).
    outbox.markInFlight({mutationId: "m1"});
    expect(() => outbox.requeue({mutationId: "m1"})).toThrow();
  });

  it("accumulates attemptCount across a failed retry cycle", () => {
    const outbox = makeOutbox();
    outbox.enqueue({args: {}, collection: "todos", mutationId: "m1", operation: "update"});

    outbox.markInFlight({mutationId: "m1"});
    outbox.markFailed({mutationId: "m1"});
    outbox.requeue({mutationId: "m1"});
    outbox.markInFlight({mutationId: "m1"});

    expect(outbox.get({mutationId: "m1"})?.attemptCount).toBe(2);
  });

  it("markQueued returns an in-flight mutation to the queue and rejects other states", () => {
    const outbox = makeOutbox();
    outbox.enqueue({args: {}, collection: "todos", mutationId: "m1", operation: "create"});

    expect(() => outbox.markQueued({mutationId: "m1"})).toThrow();
    outbox.markInFlight({mutationId: "m1"});
    outbox.markQueued({mutationId: "m1"});
    expect(outbox.get({mutationId: "m1"})?.status).toBe("queued");
  });

  it("round-trips entityId and baseVersion, reading empties back as undefined", () => {
    const outbox = makeOutbox();
    outbox.enqueue({
      args: {},
      baseVersion: "v1",
      collection: "todos",
      entityId: "t1",
      mutationId: "withMeta",
      operation: "update",
    });
    outbox.enqueue({
      args: {},
      collection: "todos",
      mutationId: "noMeta",
      operation: "create",
    });

    const withMeta = outbox.get({mutationId: "withMeta"});
    expect(withMeta?.entityId).toBe("t1");
    expect(withMeta?.baseVersion).toBe("v1");

    const noMeta = outbox.get({mutationId: "noMeta"});
    expect(noMeta?.entityId).toBeUndefined();
    expect(noMeta?.baseVersion).toBeUndefined();
  });
});
