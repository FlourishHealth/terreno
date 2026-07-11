import {describe, expect, it} from "bun:test";

import {createSyncStore, type SyncStore} from "../storage/store";
import {CONFLICTS_TABLE} from "../storage/types";
import type {OutboxStatus} from "../types";
import {getConflict} from "./conflicts";
import {createOutbox, DEFAULT_KEEP_FAILED, generateMutationId, type Outbox} from "./outbox";

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
      errorNackCount: 0,
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
  it("returns queued mutations FIFO by enqueueOrder (insertion order)", () => {
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

  it("enqueueOrder is the primary sort key — immune to createdAt traveling backward (DST/timezone offset changes)", () => {
    // A locale-offset ISO createdAt can go "backward" across a DST transition
    // even though real insertion order is forward; enqueueOrder (a monotonic
    // integer) must still win so an update never sorts before its create.
    const timestamps = ["2026-07-04T00:00:02Z", "2026-07-04T00:00:01Z", "2026-07-04T00:00:03Z"];
    let call = 0;
    const outbox = makeOutbox({
      now: () => timestamps[call++] ?? "2026-07-04T00:00:09Z",
    });
    enqueueDefault(outbox, {mutationId: "m-first"});
    enqueueDefault(outbox, {mutationId: "m-second"});
    enqueueDefault(outbox, {mutationId: "m-third"});
    expect(outbox.listQueued({userId: "user-1"}).map((mutation) => mutation.mutationId)).toEqual([
      "m-first",
      "m-second",
      "m-third",
    ]);
  });

  it("breaks enqueueOrder ties (legacy rows predating the cell) by createdAt", () => {
    const store = makeStore();
    const outbox = makeOutbox({now: () => "2026-07-04T00:00:00Z", store});
    enqueueDefault(outbox, {mutationId: "m-a"});
    enqueueDefault(outbox, {mutationId: "m-b"});
    // Simulate two legacy rows that both default to enqueueOrder 0.
    store.raw.setCell("_outbox", "m-a", "enqueueOrder", 0);
    store.raw.setCell("_outbox", "m-a", "createdAt", "2026-07-04T00:00:02Z");
    store.raw.setCell("_outbox", "m-b", "enqueueOrder", 0);
    store.raw.setCell("_outbox", "m-b", "createdAt", "2026-07-04T00:00:01Z");
    expect(outbox.listQueued({userId: "user-1"}).map((mutation) => mutation.mutationId)).toEqual([
      "m-b",
      "m-a",
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

describe("recoverStartupState (A1)", () => {
  it("transitions stranded inFlight rows back to queued without incrementing attemptCount", () => {
    const store = makeStore();
    const outbox = createOutbox({store});
    enqueueDefault(outbox, {mutationId: "m1"});
    outbox.markInFlight({mutationId: "m1"});
    expect(outbox.getMutation({mutationId: "m1"})?.attemptCount).toBe(1);

    const result = outbox.recoverStartupState({userId: "user-1"});
    expect(result.recoveredInFlight).toEqual(["m1"]);
    const mutation = outbox.getMutation({mutationId: "m1"});
    expect(mutation?.status).toBe("queued");
    // Recovery is not an attempt: attemptCount stays at its pre-crash value.
    expect(mutation?.attemptCount).toBe(1);
    // The mutation replays: it can transition inFlight again immediately.
    expect(() => outbox.markInFlight({mutationId: "m1"})).not.toThrow();
  });

  it("clears a stale pendingMutationId when an acked row's entity is still pending", () => {
    const store = makeStore();
    const outbox = createOutbox({store});
    enqueueDefault(outbox, {mutationId: "m1"});
    store.upsertEntity({
      collection: "todos",
      data: {title: "Buy milk"},
      id: "t1",
      pendingMutationId: "m1",
    });
    outbox.markInFlight({mutationId: "m1"});
    outbox.markAcked({mutationId: "m1"});
    // Simulate a crash between markAcked and releaseEntity: the entity still
    // thinks m1 is pending even though the outbox row is already acked.
    expect(store.getEntity({collection: "todos", id: "t1"})?.pendingMutationId).toBe("m1");

    const result = outbox.recoverStartupState({userId: "user-1"});
    expect(result.releasedEntities).toEqual(["t1"]);
    expect(store.getEntity({collection: "todos", id: "t1"})?.pendingMutationId).toBeUndefined();
  });

  it("does not touch an acked row's entity when a NEWER mutation owns pendingMutationId", () => {
    const store = makeStore();
    const outbox = createOutbox({store});
    enqueueDefault(outbox, {mutationId: "m1"});
    store.upsertEntity({
      collection: "todos",
      data: {title: "v1"},
      id: "t1",
      pendingMutationId: "m1",
    });
    outbox.markInFlight({mutationId: "m1"});
    outbox.markAcked({mutationId: "m1"});
    // A second optimistic edit re-protects the entity before recovery runs.
    store.upsertEntity({
      collection: "todos",
      data: {title: "v2"},
      id: "t1",
      pendingMutationId: "m2",
    });

    const result = outbox.recoverStartupState({userId: "user-1"});
    expect(result.releasedEntities).toEqual([]);
    expect(store.getEntity({collection: "todos", id: "t1"})?.pendingMutationId).toBe("m2");
  });

  it("writes a missing conflict row for a conflicted mutation with no matching _conflicts row", () => {
    const store = makeStore();
    const outbox = createOutbox({store});
    enqueueDefault(outbox, {mutationId: "m1"});
    store.upsertEntity({
      collection: "todos",
      data: {title: "local edit"},
      id: "t1",
      pendingMutationId: "m1",
    });
    outbox.markInFlight({mutationId: "m1"});
    outbox.markConflicted({mutationId: "m1"});
    // Simulate a crash between markConflicted and writeConflict: no row yet.
    expect(store.raw.hasRow(CONFLICTS_TABLE, "m1")).toBe(false);

    const result = outbox.recoverStartupState({userId: "user-1"});
    expect(result.repairedConflicts).toEqual(["m1"]);
    const conflict = getConflict({mutationId: "m1", store});
    expect(conflict).toEqual({
      collection: "todos",
      dismissed: false,
      entityId: "t1",
      localData: JSON.stringify({title: "local edit"}),
      mutationId: "m1",
      serverData: JSON.stringify(null),
      serverSeq: 0,
    });
  });

  it("leaves an existing conflict row untouched (repair is idempotent)", () => {
    const store = makeStore();
    const outbox = createOutbox({store});
    enqueueDefault(outbox, {mutationId: "m1"});
    outbox.markInFlight({mutationId: "m1"});
    outbox.markConflicted({mutationId: "m1"});
    store.raw.setRow(CONFLICTS_TABLE, "m1", {
      collection: "todos",
      dismissed: false,
      entityId: "t1",
      localData: JSON.stringify({title: "already recorded"}),
      serverData: JSON.stringify({title: "server"}),
      serverSeq: 5,
    });

    const result = outbox.recoverStartupState({userId: "user-1"});
    expect(result.repairedConflicts).toEqual([]);
    expect(getConflict({mutationId: "m1", store})?.serverSeq).toBe(5);
  });

  it("only recovers rows belonging to the requested user", () => {
    const store = makeStore();
    const outbox = createOutbox({store});
    enqueueDefault(outbox, {mutationId: "m-mine", userId: "user-1"});
    outbox.markInFlight({mutationId: "m-mine"});
    enqueueDefault(outbox, {mutationId: "m-theirs", userId: "user-2"});
    outbox.markInFlight({mutationId: "m-theirs"});

    const result = outbox.recoverStartupState({userId: "user-1"});
    expect(result.recoveredInFlight).toEqual(["m-mine"]);
    expect(outbox.getMutation({mutationId: "m-theirs"})?.status).toBe("inFlight");
  });

  it("leaves queued, acked-without-pending, and failed rows untouched", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {mutationId: "m-queued"});
    enqueueDefault(outbox, {mutationId: "m-acked"});
    outbox.markInFlight({mutationId: "m-acked"});
    outbox.markAcked({mutationId: "m-acked"});
    enqueueDefault(outbox, {mutationId: "m-failed"});
    outbox.markInFlight({mutationId: "m-failed"});
    outbox.markFailed({mutationId: "m-failed"});

    const result = outbox.recoverStartupState({userId: "user-1"});
    expect(result).toEqual({recoveredInFlight: [], releasedEntities: [], repairedConflicts: []});
    expect(outbox.getMutation({mutationId: "m-queued"})?.status).toBe("queued");
    expect(outbox.getMutation({mutationId: "m-acked"})?.status).toBe("acked");
    expect(outbox.getMutation({mutationId: "m-failed"})?.status).toBe("failed");
  });
});

describe("prune (A5)", () => {
  it("deletes acked rows for the user", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {mutationId: "m-acked"});
    outbox.markInFlight({mutationId: "m-acked"});
    outbox.markAcked({mutationId: "m-acked"});
    enqueueDefault(outbox, {mutationId: "m-queued"});

    outbox.prune({userId: "user-1"});
    expect(outbox.getMutation({mutationId: "m-acked"})).toBeUndefined();
    expect(outbox.getMutation({mutationId: "m-queued"})).toBeDefined();
  });

  it("keeps only the most recent `keepFailed` failed rows, oldest first deleted", () => {
    const outbox = makeOutbox();
    for (let i = 0; i < 5; i += 1) {
      const mutationId = `m-failed-${i}`;
      enqueueDefault(outbox, {mutationId});
      outbox.markInFlight({mutationId});
      outbox.markFailed({mutationId});
    }
    outbox.prune({keepFailed: 2, userId: "user-1"});
    expect(outbox.getMutation({mutationId: "m-failed-0"})).toBeUndefined();
    expect(outbox.getMutation({mutationId: "m-failed-1"})).toBeUndefined();
    expect(outbox.getMutation({mutationId: "m-failed-2"})).toBeUndefined();
    // The two most recently enqueued (highest enqueueOrder) survive.
    expect(outbox.getMutation({mutationId: "m-failed-3"})).toBeDefined();
    expect(outbox.getMutation({mutationId: "m-failed-4"})).toBeDefined();
  });

  it("defaults keepFailed to DEFAULT_KEEP_FAILED", () => {
    const outbox = makeOutbox();
    for (let i = 0; i < DEFAULT_KEEP_FAILED + 3; i += 1) {
      const mutationId = `m-failed-${i}`;
      enqueueDefault(outbox, {mutationId});
      outbox.markInFlight({mutationId});
      outbox.markFailed({mutationId});
    }
    outbox.prune({userId: "user-1"});
    let remaining = 0;
    for (let i = 0; i < DEFAULT_KEEP_FAILED + 3; i += 1) {
      if (outbox.getMutation({mutationId: `m-failed-${i}`})) {
        remaining += 1;
      }
    }
    expect(remaining).toBe(DEFAULT_KEEP_FAILED);
  });

  it("never prunes conflicted rows", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {mutationId: "m-conflicted"});
    outbox.markInFlight({mutationId: "m-conflicted"});
    outbox.markConflicted({mutationId: "m-conflicted"});

    outbox.prune({keepFailed: 0, userId: "user-1"});
    expect(outbox.getMutation({mutationId: "m-conflicted"})?.status).toBe("conflicted");
  });

  it("only prunes rows belonging to the requested user", () => {
    const outbox = makeOutbox();
    enqueueDefault(outbox, {mutationId: "m-mine", userId: "user-1"});
    outbox.markInFlight({mutationId: "m-mine"});
    outbox.markAcked({mutationId: "m-mine"});
    enqueueDefault(outbox, {mutationId: "m-theirs", userId: "user-2"});
    outbox.markInFlight({mutationId: "m-theirs"});
    outbox.markAcked({mutationId: "m-theirs"});

    outbox.prune({userId: "user-1"});
    expect(outbox.getMutation({mutationId: "m-mine"})).toBeUndefined();
    expect(outbox.getMutation({mutationId: "m-theirs"})).toBeDefined();
  });
});

describe("enqueueOrder persistence (A5)", () => {
  it("survives a store reload via the outboxMaxEnqueueOrder meta cell", () => {
    const store = makeStore();
    const outbox = createOutbox({store});
    enqueueDefault(outbox, {mutationId: "m1"});
    enqueueDefault(outbox, {mutationId: "m2"});

    const rebound = createOutbox({store});
    const mutation = rebound.enqueue({
      args: {},
      collection: "todos",
      entityId: "t3",
      mutationId: "m3",
      operation: "create",
      userId: "user-1",
    });
    // The rebound outbox must not restart the counter — m3 sorts after m1/m2.
    expect(
      rebound.listQueued({userId: "user-1"}).map((mutationEntry) => mutationEntry.mutationId)
    ).toEqual(["m1", "m2", "m3"]);
    expect(mutation.mutationId).toBe("m3");
  });

  it("rebuilds the counter from a table scan when the meta cell is absent (pre-A5 persisted store)", () => {
    const store = makeStore();
    const outbox = createOutbox({store});
    enqueueDefault(outbox, {mutationId: "m1"});
    enqueueDefault(outbox, {mutationId: "m2"});
    // Simulate a store persisted before the meta cell existed.
    store.raw.setValue("outboxMaxEnqueueOrder", 0);

    const rebound = createOutbox({store});
    const mutation = rebound.enqueue({
      args: {},
      collection: "todos",
      entityId: "t3",
      mutationId: "m3",
      operation: "create",
      userId: "user-1",
    });
    expect(
      rebound.listQueued({userId: "user-1"}).map((mutationEntry) => mutationEntry.mutationId)
    ).toEqual(["m1", "m2", "m3"]);
    expect(mutation.mutationId).toBe("m3");
  });
});
