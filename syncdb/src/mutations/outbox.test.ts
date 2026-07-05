import {describe, expect, it} from "bun:test";

import {createSyncStore, type SyncStore} from "../storage/store";
import type {OutboxStatus} from "../types";
import {createOutbox, generateMutationId, type Outbox} from "./outbox";

const makeStore = (): SyncStore => createSyncStore({collections: ["todos"]});

const makeOutbox = ({
  store = makeStore(),
  now,
}: {
  store?: SyncStore;
  now?: () => string;
} = {}): Outbox => createOutbox({now, store});

const enqueueDefault = (
  outbox: Outbox,
  overrides: {
    collection?: string;
    entityId?: string;
    mutationId?: string;
    userId?: string;
    baseVersion?: number;
  } = {}
) =>
  outbox.enqueue({
    args: {title: "Buy milk"},
    collection: overrides.collection ?? "todos",
    entityId: overrides.entityId ?? "t1",
    mutationId: overrides.mutationId,
    operation: "update",
    userId: overrides.userId ?? "user-1",
    ...(overrides.baseVersion !== undefined ? {baseVersion: overrides.baseVersion} : {}),
  });

describe("generateMutationId", () => {
  it("generates unique ids", () => {
    expect(generateMutationId()).not.toBe(generateMutationId());
  });
});

describe("enqueue / getMutation", () => {
  it("enqueues a queued mutation with serialized args and injected timestamp", () => {
    const outbox = makeOutbox({now: () => "2026-07-04T00:00:00.000Z"});
    const mutation = enqueueDefault(outbox, {baseVersion: 5, mutationId: "m1"});
    expect(mutation).toEqual({
      args: JSON.stringify({title: "Buy milk"}),
      attemptCount: 0,
      baseVersion: 5,
      collection: "todos",
      createdAt: "2026-07-04T00:00:00.000Z",
      entityId: "t1",
      mutationId: "m1",
      operation: "update",
      status: "queued",
      userId: "user-1",
    });
    expect(outbox.getMutation({mutationId: "m1"})).toEqual(mutation);
  });

  it("generates a mutationId when none is provided", () => {
    const outbox = makeOutbox();
    const mutation = enqueueDefault(outbox);
    expect(mutation.mutationId.length).toBeGreaterThan(0);
    expect(outbox.getMutation({mutationId: mutation.mutationId})).toBeDefined();
  });

  it("leaves baseVersion undefined when not provided", () => {
    const outbox = makeOutbox();
    const mutation = enqueueDefault(outbox, {mutationId: "m1"});
    expect(mutation.baseVersion).toBeUndefined();
    expect(outbox.getMutation({mutationId: "m1"})?.baseVersion).toBeUndefined();
  });

  it("returns undefined for a missing mutation", () => {
    const outbox = makeOutbox();
    expect(outbox.getMutation({mutationId: "nope"})).toBeUndefined();
  });

  it("survives a store reload (rows are durable, not in-memory state)", () => {
    const store = makeStore();
    const outbox = makeOutbox({store});
    enqueueDefault(outbox, {mutationId: "m1"});
    const rebound = createOutbox({store});
    expect(rebound.getMutation({mutationId: "m1"})?.status).toBe("queued");
  });
});

describe("listQueued", () => {
  it("returns queued mutations FIFO by createdAt", () => {
    const timestamps = ["2026-07-04T00:00:02Z", "2026-07-04T00:00:01Z", "2026-07-04T00:00:03Z"];
    let call = 0;
    const outbox = makeOutbox({
      now: () => timestamps[call++] ?? "2026-07-04T00:00:09Z",
    });
    enqueueDefault(outbox, {mutationId: "m-second"});
    enqueueDefault(outbox, {mutationId: "m-first"});
    enqueueDefault(outbox, {mutationId: "m-third"});
    expect(outbox.listQueued({userId: "user-1"}).map((mutation) => mutation.mutationId)).toEqual([
      "m-first",
      "m-second",
      "m-third",
    ]);
  });

  it("breaks createdAt ties by insertion order", () => {
    const outbox = makeOutbox({now: () => "2026-07-04T00:00:00Z"});
    enqueueDefault(outbox, {mutationId: "m-a"});
    enqueueDefault(outbox, {mutationId: "m-b"});
    enqueueDefault(outbox, {mutationId: "m-c"});
    expect(outbox.listQueued({userId: "user-1"}).map((mutation) => mutation.mutationId)).toEqual([
      "m-a",
      "m-b",
      "m-c",
    ]);
  });

  it("only returns mutations for the requested user", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {mutationId: "m-mine", userId: "user-1"});
    enqueueDefault(outbox, {mutationId: "m-theirs", userId: "user-2"});
    expect(outbox.listQueued({userId: "user-1"}).map((mutation) => mutation.mutationId)).toEqual([
      "m-mine",
    ]);
  });

  it("filters by collection when provided", () => {
    const store = createSyncStore({collections: ["todos", "notes"]});
    const outbox = createOutbox({store});
    enqueueDefault(outbox, {collection: "todos", mutationId: "m-todo"});
    enqueueDefault(outbox, {collection: "notes", mutationId: "m-note"});
    expect(
      outbox
        .listQueued({collection: "notes", userId: "user-1"})
        .map((mutation) => mutation.mutationId)
    ).toEqual(["m-note"]);
  });

  it("excludes non-queued mutations", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {mutationId: "m-queued"});
    enqueueDefault(outbox, {mutationId: "m-flying"});
    outbox.markInFlight({mutationId: "m-flying"});
    expect(outbox.listQueued({userId: "user-1"}).map((mutation) => mutation.mutationId)).toEqual([
      "m-queued",
    ]);
  });
});

describe("state machine transitions", () => {
  const statusOf = (outbox: Outbox, mutationId: string): OutboxStatus | undefined =>
    outbox.getMutation({mutationId})?.status;

  it("queued → inFlight increments attemptCount", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {mutationId: "m1"});
    outbox.markInFlight({mutationId: "m1"});
    expect(statusOf(outbox, "m1")).toBe("inFlight");
    expect(outbox.getMutation({mutationId: "m1"})?.attemptCount).toBe(1);
  });

  it("inFlight → acked", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {mutationId: "m1"});
    outbox.markInFlight({mutationId: "m1"});
    outbox.markAcked({mutationId: "m1"});
    expect(statusOf(outbox, "m1")).toBe("acked");
  });

  it("inFlight → conflicted", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {mutationId: "m1"});
    outbox.markInFlight({mutationId: "m1"});
    outbox.markConflicted({mutationId: "m1"});
    expect(statusOf(outbox, "m1")).toBe("conflicted");
  });

  it("inFlight → failed", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {mutationId: "m1"});
    outbox.markInFlight({mutationId: "m1"});
    outbox.markFailed({mutationId: "m1"});
    expect(statusOf(outbox, "m1")).toBe("failed");
  });

  it("inFlight → queued (retry after transient error) preserves attemptCount", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {mutationId: "m1"});
    outbox.markInFlight({mutationId: "m1"});
    outbox.markQueued({mutationId: "m1"});
    expect(statusOf(outbox, "m1")).toBe("queued");
    expect(outbox.getMutation({mutationId: "m1"})?.attemptCount).toBe(1);
    outbox.markInFlight({mutationId: "m1"});
    expect(outbox.getMutation({mutationId: "m1"})?.attemptCount).toBe(2);
  });

  it("conflicted → queued via requeue mints a fresh mutationId with the new baseVersion (keepMine)", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {baseVersion: 3, mutationId: "m1"});
    outbox.markInFlight({mutationId: "m1"});
    outbox.markConflicted({mutationId: "m1"});
    const retry = outbox.requeue({baseVersion: 9, mutationId: "m1"});
    // The original id is burned on the server's idempotency ledger — the retry is a new
    // mutation under a new id, cloned from the conflicted row.
    expect(retry.mutationId).not.toBe("m1");
    expect(outbox.getMutation({mutationId: "m1"})).toBeUndefined();
    const mutation = outbox.getMutation({mutationId: retry.mutationId});
    expect(mutation?.status).toBe("queued");
    expect(mutation?.baseVersion).toBe(9);
    expect(mutation?.attemptCount).toBe(0);
    expect(mutation?.collection).toBe("todos");
    expect(mutation?.entityId).toBe("t1");
    expect(mutation?.operation).toBe("update");
  });

  it("requeue keeps the previous baseVersion when none is provided", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {baseVersion: 3, mutationId: "m1"});
    outbox.markInFlight({mutationId: "m1"});
    outbox.markConflicted({mutationId: "m1"});
    const retry = outbox.requeue({mutationId: "m1"});
    expect(outbox.getMutation({mutationId: retry.mutationId})?.baseVersion).toBe(3);
  });

  it("requeue preserves the original FIFO position", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {entityId: "t1", mutationId: "m1"});
    enqueueDefault(outbox, {entityId: "t2", mutationId: "m2"});
    outbox.markInFlight({mutationId: "m1"});
    outbox.markConflicted({mutationId: "m1"});
    const retry = outbox.requeue({mutationId: "m1"});
    const queued = outbox.listQueued({userId: "user-1"});
    expect(queued.map((mutation) => mutation.mutationId)).toEqual([retry.mutationId, "m2"]);
  });

  it("throws on illegal transitions from queued", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {mutationId: "m1"});
    expect(() => outbox.markAcked({mutationId: "m1"})).toThrow(/Illegal outbox transition/);
    expect(() => outbox.markConflicted({mutationId: "m1"})).toThrow(/Illegal outbox transition/);
    expect(() => outbox.markFailed({mutationId: "m1"})).toThrow(/Illegal outbox transition/);
    expect(() => outbox.markQueued({mutationId: "m1"})).toThrow(/Illegal outbox transition/);
    expect(() => outbox.requeue({mutationId: "m1"})).toThrow(/Illegal outbox transition/);
  });

  it("throws on double markInFlight", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {mutationId: "m1"});
    outbox.markInFlight({mutationId: "m1"});
    expect(() => outbox.markInFlight({mutationId: "m1"})).toThrow(/Illegal outbox transition/);
  });

  it("treats acked and failed as terminal", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {mutationId: "m-acked"});
    outbox.markInFlight({mutationId: "m-acked"});
    outbox.markAcked({mutationId: "m-acked"});
    expect(() => outbox.markInFlight({mutationId: "m-acked"})).toThrow(/Illegal outbox transition/);
    expect(() => outbox.requeue({mutationId: "m-acked"})).toThrow(/Illegal outbox transition/);

    enqueueDefault(outbox, {mutationId: "m-failed"});
    outbox.markInFlight({mutationId: "m-failed"});
    outbox.markFailed({mutationId: "m-failed"});
    expect(() => outbox.requeue({mutationId: "m-failed"})).toThrow(/Illegal outbox transition/);
    expect(() => outbox.markInFlight({mutationId: "m-failed"})).toThrow(
      /Illegal outbox transition/
    );
  });

  it("throws for a missing mutation on every transition", () => {
    const outbox = makeOutbox();
    expect(() => outbox.markInFlight({mutationId: "nope"})).toThrow(/not found/);
    expect(() => outbox.markQueued({mutationId: "nope"})).toThrow(/not found/);
    expect(() => outbox.markAcked({mutationId: "nope"})).toThrow(/not found/);
    expect(() => outbox.markConflicted({mutationId: "nope"})).toThrow(/not found/);
    expect(() => outbox.markFailed({mutationId: "nope"})).toThrow(/not found/);
    expect(() => outbox.requeue({mutationId: "nope"})).toThrow(/not found/);
  });
});

describe("clearForUser", () => {
  it("removes all mutations for the user regardless of status", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {mutationId: "m-queued", userId: "user-1"});
    enqueueDefault(outbox, {mutationId: "m-flying", userId: "user-1"});
    outbox.markInFlight({mutationId: "m-flying"});
    enqueueDefault(outbox, {mutationId: "m-other", userId: "user-2"});
    outbox.clearForUser({userId: "user-1"});
    expect(outbox.getMutation({mutationId: "m-queued"})).toBeUndefined();
    expect(outbox.getMutation({mutationId: "m-flying"})).toBeUndefined();
    expect(outbox.getMutation({mutationId: "m-other"})).toBeDefined();
  });
});
