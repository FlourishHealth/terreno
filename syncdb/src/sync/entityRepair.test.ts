import {describe, expect, it} from "bun:test";

import {createSyncStore, type SyncStore} from "../storage/store";
import {applyRepairedEntity, repairMarkedEntities} from "./entityRepair";

const STREAM = "todos|owner:u1";

const makeStore = (): SyncStore => createSyncStore({collections: ["todos"]});

describe("entityRepair", () => {
  it("marks and repairs an entity after a skipped delta", async () => {
    const store = makeStore();
    store.upsertEntity({
      collection: "todos",
      data: {title: "Optimistic"},
      id: "t1",
      pendingMutationId: "m1",
      seq: 1,
    });
    store.markNeedsRepair({
      collection: "todos",
      entityId: "t1",
      missedSeq: 4,
      stream: STREAM,
    });
    store.upsertEntity({
      collection: "todos",
      data: {title: "Optimistic"},
      id: "t1",
      pendingMutationId: "",
      seq: 1,
    });

    const repaired = await repairMarkedEntities({
      channel: {
        fetchEntities: async () => ({
          entities: [{data: {title: "Server truth"}, deleted: false, id: "t1", seq: 4}],
        }),
      },
      collection: "todos",
      entityIds: ["t1"],
      store,
    });

    expect(repaired).toBe(1);
    expect(store.getEntity({collection: "todos", id: "t1"})).toEqual({
      data: {title: "Server truth"},
      deleted: false,
      id: "t1",
      pendingMutationId: undefined,
      seq: 4,
      stream: STREAM,
    });
    expect(store.hasNeedsRepair({collection: "todos", entityId: "t1"})).toBe(false);
  });

  it("does not overwrite entities that still have a pendingMutationId", async () => {
    const store = makeStore();
    store.upsertEntity({
      collection: "todos",
      data: {title: "Optimistic"},
      id: "t1",
      pendingMutationId: "m1",
      seq: 1,
    });
    store.markNeedsRepair({
      collection: "todos",
      entityId: "t1",
      missedSeq: 4,
      stream: STREAM,
    });

    const repaired = await repairMarkedEntities({
      channel: {
        fetchEntities: async () => ({
          entities: [{data: {title: "Server truth"}, deleted: false, id: "t1", seq: 4}],
        }),
      },
      collection: "todos",
      entityIds: ["t1"],
      store,
    });

    expect(repaired).toBe(0);
    expect(store.getEntity({collection: "todos", id: "t1"})).toEqual({
      data: {title: "Optimistic"},
      deleted: false,
      id: "t1",
      pendingMutationId: "m1",
      seq: 1,
      stream: undefined,
    });
    // Mark kept so a later pass (after the pending mutation resolves) can repair.
    expect(store.hasNeedsRepair({collection: "todos", entityId: "t1"})).toBe(true);
  });

  // A mark the server can never satisfy (hard-deleted doc, permission-filtered doc,
  // or a client-minted id whose create never landed) used to stay marked forever, so
  // every reconcile re-fetched it and held isSyncing high for the whole pass.
  it("clears marks for ids the server does not return", async () => {
    const store = makeStore();
    store.markNeedsRepair({
      collection: "todos",
      entityId: "missing-on-server",
      missedSeq: 7,
      stream: STREAM,
    });

    const repaired = await repairMarkedEntities({
      channel: {fetchEntities: async () => ({entities: []})},
      collection: "todos",
      store,
    });

    expect(repaired).toBe(0);
    expect(store.hasNeedsRepair({collection: "todos", entityId: "missing-on-server"})).toBe(false);
    expect(store.listNeedsRepair()).toHaveLength(0);
  });

  it("does not refetch ids the server already declined to return", async () => {
    const store = makeStore();
    store.markNeedsRepair({
      collection: "todos",
      entityId: "missing-on-server",
      missedSeq: 7,
      stream: STREAM,
    });
    const requestedIds: string[][] = [];
    const channel = {
      fetchEntities: async ({ids}: {collection: string; ids: string[]}) => {
        requestedIds.push(ids);
        return {entities: []};
      },
    };

    await repairMarkedEntities({channel, collection: "todos", store});
    await repairMarkedEntities({channel, collection: "todos", store});

    expect(requestedIds).toEqual([["missing-on-server"]]);
  });

  it("applyRepairedEntity applies tombstones from the server", () => {
    const store = makeStore();
    store.markNeedsRepair({
      collection: "todos",
      entityId: "t1",
      missedSeq: 9,
      stream: STREAM,
    });
    applyRepairedEntity({
      collection: "todos",
      entity: {data: null, deleted: true, id: "t1", seq: 9},
      store,
      stream: STREAM,
    });
    const entity = store.getEntity({collection: "todos", id: "t1"});
    expect(entity?.deleted).toBe(true);
    expect(entity?.seq).toBe(9);
    expect(store.listEntities({collection: "todos"})).toHaveLength(0);
  });
});
