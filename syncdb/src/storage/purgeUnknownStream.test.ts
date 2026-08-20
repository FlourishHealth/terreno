import {describe, expect, it} from "bun:test";

import {createSyncStore, type SyncStore} from "./store";

const STREAM = "todos|owner:u1";

const makeStore = (): SyncStore => createSyncStore({collections: ["todos"]});

describe("purgeUnknownStreamEntities", () => {
  it("removes phantom rows that never synced and have no pending mutation", () => {
    const store = makeStore();
    store.upsertEntity({
      collection: "todos",
      data: {title: "Phantom from a failed create"},
      id: "phantom",
      pendingMutationId: "",
      seq: 0,
    });

    expect(store.purgeUnknownStreamEntities({collection: "todos"})).toBe(1);
    expect(store.getEntity({collection: "todos", id: "phantom"})).toBeUndefined();
  });

  it("keeps rows still protected by a pending outbox mutation", () => {
    const store = makeStore();
    store.upsertEntity({
      collection: "todos",
      data: {title: "Queued local create"},
      id: "queued",
      pendingMutationId: "m1",
      seq: 0,
    });

    expect(store.purgeUnknownStreamEntities({collection: "todos"})).toBe(0);
    expect(store.getEntity({collection: "todos", id: "queued"})?.data).toEqual({
      title: "Queued local create",
    });
  });

  it("keeps server-synced rows that carry stream provenance", () => {
    const store = makeStore();
    store.upsertEntity({
      collection: "todos",
      data: {title: "From server"},
      id: "synced",
      pendingMutationId: "",
      seq: 3,
      stream: STREAM,
    });

    expect(store.purgeUnknownStreamEntities({collection: "todos"})).toBe(0);
    expect(store.getEntity({collection: "todos", id: "synced"})?.seq).toBe(3);
  });

  it("clears any repair marker for a purged phantom", () => {
    const store = makeStore();
    store.upsertEntity({
      collection: "todos",
      data: {title: "Phantom"},
      id: "phantom",
      pendingMutationId: "",
      seq: 0,
    });
    store.markNeedsRepair({
      collection: "todos",
      entityId: "phantom",
      missedSeq: 2,
      stream: STREAM,
    });

    store.purgeUnknownStreamEntities({collection: "todos"});
    expect(store.hasNeedsRepair({collection: "todos", entityId: "phantom"})).toBe(false);
  });
});
