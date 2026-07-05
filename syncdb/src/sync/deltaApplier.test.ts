import {describe, expect, it} from "bun:test";

import {createSyncStore, type SyncStore} from "../storage/store";
import type {SyncDelta} from "../types";
import {getCursor} from "./cursor";
import {applyDelta} from "./deltaApplier";

const STREAM = "todos|owner:u1";

const makeStore = (): SyncStore => createSyncStore({collections: ["todos"]});

const makeDelta = (overrides: Partial<SyncDelta> = {}): SyncDelta => ({
  collection: "todos",
  data: {title: "From server"},
  id: "t1",
  method: "create",
  seq: 1,
  stream: STREAM,
  ...overrides,
});

describe("applyDelta", () => {
  it("applies a create delta and advances the stream cursor", () => {
    const store = makeStore();
    const result = applyDelta({delta: makeDelta(), store});
    expect(result).toEqual({applied: true, seqJump: false});
    expect(store.getEntity({collection: "todos", id: "t1"})).toEqual({
      data: {title: "From server"},
      deleted: false,
      id: "t1",
      pendingMutationId: undefined,
      seq: 1,
    });
    expect(getCursor({store, stream: STREAM})).toBe(1);
  });

  it("applies an update delta over an existing entity", () => {
    const store = makeStore();
    applyDelta({delta: makeDelta(), store});
    const result = applyDelta({
      delta: makeDelta({data: {title: "Updated"}, method: "update", seq: 2}),
      store,
    });
    expect(result.applied).toBe(true);
    const entity = store.getEntity({collection: "todos", id: "t1"});
    expect(entity?.data).toEqual({title: "Updated"});
    expect(entity?.seq).toBe(2);
  });

  it("is idempotent for a duplicate delta (same seq)", () => {
    const store = makeStore();
    applyDelta({delta: makeDelta({data: {title: "v1"}, seq: 3}), store});
    const result = applyDelta({delta: makeDelta({data: {title: "dupe"}, seq: 3}), store});
    expect(result.applied).toBe(false);
    expect(store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "v1"});
    expect(getCursor({store, stream: STREAM})).toBe(3);
  });

  it("skips an out-of-order older delta without rewinding entity or cursor", () => {
    const store = makeStore();
    applyDelta({delta: makeDelta({data: {title: "v5"}, seq: 5}), store});
    const result = applyDelta({
      delta: makeDelta({data: {title: "stale"}, method: "update", seq: 2}),
      store,
    });
    expect(result.applied).toBe(false);
    expect(store.getEntity({collection: "todos", id: "t1"})?.seq).toBe(5);
    expect(getCursor({store, stream: STREAM})).toBe(5);
  });

  it("never overwrites an entity with a pending outbox mutation, but still advances the cursor", () => {
    const store = makeStore();
    store.upsertEntity({
      collection: "todos",
      data: {title: "Optimistic"},
      id: "t1",
      pendingMutationId: "m1",
      seq: 1,
    });
    const result = applyDelta({
      delta: makeDelta({data: {title: "Server wins?"}, method: "update", seq: 4}),
      store,
    });
    expect(result.applied).toBe(false);
    const entity = store.getEntity({collection: "todos", id: "t1"});
    expect(entity?.data).toEqual({title: "Optimistic"});
    expect(entity?.pendingMutationId).toBe("m1");
    expect(entity?.seq).toBe(1);
    expect(getCursor({store, stream: STREAM})).toBe(4);
  });

  it("applies a tombstone delta, preserving the last known data", () => {
    const store = makeStore();
    applyDelta({delta: makeDelta({data: {title: "Alive"}, seq: 1}), store});
    const result = applyDelta({
      delta: makeDelta({data: undefined, deleted: true, method: "delete", seq: 2}),
      store,
    });
    expect(result.applied).toBe(true);
    const entity = store.getEntity({collection: "todos", id: "t1"});
    expect(entity?.deleted).toBe(true);
    expect(entity?.data).toEqual({title: "Alive"});
    expect(entity?.seq).toBe(2);
    expect(store.listEntities({collection: "todos"})).toHaveLength(0);
  });

  it("creates a tombstone for a never-seen entity (scope-move tombstones)", () => {
    const store = makeStore();
    const result = applyDelta({
      delta: makeDelta({data: undefined, deleted: true, method: "delete", seq: 7}),
      store,
    });
    expect(result.applied).toBe(true);
    const entity = store.getEntity({collection: "todos", id: "t1"});
    expect(entity?.deleted).toBe(true);
    expect(entity?.data).toBeNull();
  });

  it("treats a delete method without an explicit deleted flag as a tombstone", () => {
    const store = makeStore();
    applyDelta({delta: makeDelta({seq: 1}), store});
    applyDelta({delta: makeDelta({data: undefined, method: "delete", seq: 2}), store});
    expect(store.getEntity({collection: "todos", id: "t1"})?.deleted).toBe(true);
  });

  it("reports a seq jump (before applying) as a hint, while still applying", () => {
    const store = makeStore();
    const result = applyDelta({delta: makeDelta({seq: 5}), store});
    expect(result).toEqual({applied: true, seqJump: true});
    expect(store.getEntity({collection: "todos", id: "t1"})?.seq).toBe(5);
    expect(getCursor({store, stream: STREAM})).toBe(5);
  });

  it("does not report a seq jump for contiguous deltas", () => {
    const store = makeStore();
    applyDelta({delta: makeDelta({seq: 1}), store});
    const result = applyDelta({
      delta: makeDelta({id: "t2", method: "create", seq: 2}),
      store,
    });
    expect(result.seqJump).toBe(false);
  });

  it("reports seq jumps on skipped deltas too", () => {
    const store = makeStore();
    store.upsertEntity({
      collection: "todos",
      data: {title: "Optimistic"},
      id: "t1",
      pendingMutationId: "m1",
      seq: 1,
    });
    const result = applyDelta({delta: makeDelta({method: "update", seq: 9}), store});
    expect(result).toEqual({applied: false, seqJump: true});
  });

  it("keys cursors by the delta's stream, not its collection", () => {
    const store = makeStore();
    applyDelta({delta: makeDelta({seq: 1, stream: "todos|owner:u1"}), store});
    applyDelta({
      delta: makeDelta({id: "t2", seq: 4, stream: "todos|tenant:org1"}),
      store,
    });
    expect(getCursor({store, stream: "todos|owner:u1"})).toBe(1);
    expect(getCursor({store, stream: "todos|tenant:org1"})).toBe(4);
    expect(getCursor({store, stream: "todos"})).toBe(0);
  });

  it("clears a stale pendingMutationId when applying over a non-pending entity", () => {
    const store = makeStore();
    applyDelta({delta: makeDelta({seq: 1}), store});
    const result = applyDelta({
      delta: makeDelta({data: {title: "v2"}, method: "update", seq: 2}),
      store,
    });
    expect(result.applied).toBe(true);
    expect(store.getEntity({collection: "todos", id: "t1"})?.pendingMutationId).toBeUndefined();
  });

  it("passes the injected clock through to the cursor row", () => {
    const store = makeStore();
    applyDelta({delta: makeDelta(), now: () => "2026-07-04T12:00:00Z", store});
    expect(store.raw.getCell("_cursors", STREAM, "updatedAt")).toBe("2026-07-04T12:00:00Z");
  });

  it("throws for a delta targeting an unknown collection", () => {
    const store = makeStore();
    expect(() => applyDelta({delta: makeDelta({collection: "nope"}), store})).toThrow(
      /Unknown collection/
    );
  });
});
