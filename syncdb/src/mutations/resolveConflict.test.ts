import {describe, expect, it} from "bun:test";

import {createSyncStore, type SyncStore} from "../storage/store";
import {
  deleteConflict,
  getConflict,
  listConflicts,
  pruneGhostConflicts,
  writeConflict,
} from "./conflicts";
import {createOutbox, type Outbox} from "./outbox";
import {resolveConflict} from "./resolveConflict";

const USER = "user-1";

const makeHarness = (): {store: SyncStore; outbox: Outbox} => {
  const store = createSyncStore({collections: ["todos"]});
  const outbox = createOutbox({store});
  return {outbox, store};
};

/** Seed a conflicted mutation + optimistic entity + conflict row. */
const seedConflict = ({store, outbox}: {store: SyncStore; outbox: Outbox}): void => {
  store.upsertEntity({
    collection: "todos",
    data: {title: "local"},
    id: "t1",
    pendingMutationId: "m1",
    seq: 2,
  });
  outbox.enqueue({
    args: {title: "local"},
    baseVersion: 2,
    collection: "todos",
    entityId: "t1",
    mutationId: "m1",
    operation: "update",
    userId: USER,
  });
  outbox.markInFlight({mutationId: "m1"});
  outbox.markConflicted({mutationId: "m1"});
  writeConflict({
    conflict: {
      collection: "todos",
      dismissed: false,
      entityId: "t1",
      localData: JSON.stringify({title: "local"}),
      mutationId: "m1",
      serverData: JSON.stringify({title: "server"}),
      serverSeq: 9,
    },
    store,
  });
};

describe("resolveConflict", () => {
  it("useServer applies the server data/seq, clears pending, and deletes the conflict", () => {
    const harness = makeHarness();
    seedConflict(harness);

    resolveConflict({
      mutationId: "m1",
      outbox: harness.outbox,
      store: harness.store,
      strategy: "useServer",
    });

    const entity = harness.store.getEntity({collection: "todos", id: "t1"});
    expect(entity?.data).toEqual({title: "server"});
    expect(entity?.seq).toBe(9);
    expect(entity?.pendingMutationId).toBeUndefined();
    expect(getConflict({mutationId: "m1", store: harness.store})).toBeUndefined();
    // The spent conflicted outbox row is discarded so startup recovery cannot
    // resurrect a phantom conflict from it.
    expect(harness.outbox.getMutation({mutationId: "m1"})).toBeUndefined();
    expect(harness.outbox.listQueued({userId: USER})).toHaveLength(0);
  });

  it("useServer tolerates corrupt serverData by applying null", () => {
    const harness = makeHarness();
    seedConflict(harness);
    harness.store.raw.setCell("_conflicts", "m1", "serverData", "{corrupt");

    resolveConflict({
      mutationId: "m1",
      outbox: harness.outbox,
      store: harness.store,
      strategy: "useServer",
    });
    expect(harness.store.getEntity({collection: "todos", id: "t1"})?.data).toBeNull();
  });

  it("keepMine requeues under a fresh mutationId with baseVersion = serverSeq and keeps the local entity", () => {
    const harness = makeHarness();
    seedConflict(harness);

    resolveConflict({
      mutationId: "m1",
      outbox: harness.outbox,
      store: harness.store,
      strategy: "keepMine",
    });

    // The retry carries a fresh mutationId: the original id is burned on the server's
    // idempotency ledger (it would replay the recorded conflict nack forever).
    expect(harness.outbox.getMutation({mutationId: "m1"})).toBeUndefined();
    const queued = harness.outbox.listQueued({userId: USER});
    expect(queued).toHaveLength(1);
    const retry = queued[0];
    expect(retry.mutationId).not.toBe("m1");
    expect(retry.status).toBe("queued");
    expect(retry.baseVersion).toBe(9);
    expect(getConflict({mutationId: "m1", store: harness.store})).toBeUndefined();
    const entity = harness.store.getEntity({collection: "todos", id: "t1"});
    expect(entity?.data).toEqual({title: "local"});
    // The optimistic guard is re-pointed at the retry so its ack can release it.
    expect(entity?.pendingMutationId).toBe(retry.mutationId);
  });

  it("keepMine repairs a corrupt queued+conflict row instead of throwing queued→queued", () => {
    const harness = makeHarness();
    seedConflict(harness);
    // Simulate the historical bug: markQueued was incorrectly legal from
    // conflicted, leaving a `_conflicts` row pointing at a queued mutation.
    harness.store.raw.setCell("_outbox", "m1", "status", "queued");
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("queued");

    resolveConflict({
      mutationId: "m1",
      outbox: harness.outbox,
      store: harness.store,
      strategy: "keepMine",
    });

    expect(harness.outbox.getMutation({mutationId: "m1"})).toBeUndefined();
    const queued = harness.outbox.listQueued({userId: USER});
    expect(queued).toHaveLength(1);
    expect(queued[0].mutationId).not.toBe("m1");
    expect(queued[0].baseVersion).toBe(9);
    expect(getConflict({mutationId: "m1", store: harness.store})).toBeUndefined();
  });

  it("throws for an unknown conflict", () => {
    const harness = makeHarness();
    expect(() =>
      resolveConflict({
        mutationId: "missing",
        outbox: harness.outbox,
        store: harness.store,
        strategy: "useServer",
      })
    ).toThrow("Conflict not found: missing");
  });
});

describe("conflict row helpers", () => {
  it("write/get/delete round-trips a conflict row", () => {
    const harness = makeHarness();
    seedConflict(harness);
    expect(getConflict({mutationId: "m1", store: harness.store})?.entityId).toBe("t1");
    deleteConflict({mutationId: "m1", store: harness.store});
    expect(getConflict({mutationId: "m1", store: harness.store})).toBeUndefined();
  });

  it("listConflicts excludes dismissed rows unless requested", () => {
    const harness = makeHarness();
    seedConflict(harness);
    harness.store.raw.setCell("_conflicts", "m1", "dismissed", true);
    expect(listConflicts({store: harness.store})).toHaveLength(0);
    expect(listConflicts({includeDismissed: true, store: harness.store})).toHaveLength(1);
  });
});

/**
 * Husk rows are what a pre-fix build persisted when TinyBase re-materialized a
 * deleted `_conflicts` row from its schema defaults: no `collection`, no
 * `entityId`, nothing to resolve. They must never reach the UI, and resolving
 * one must not reach `upsertEntity` (which threw `Unknown collection ""`).
 */
describe("husk conflict rows", () => {
  const seedHusk = (store: SyncStore): void => {
    store.raw.setRow("_conflicts", "husk", {dismissed: false, serverSeq: 0});
  };

  it("are hidden from getConflict and listConflicts", () => {
    const harness = makeHarness();
    seedConflict(harness);
    seedHusk(harness.store);
    expect(getConflict({mutationId: "husk", store: harness.store})).toBeUndefined();
    expect(
      listConflicts({includeDismissed: true, store: harness.store}).map((c) => c.mutationId)
    ).toEqual(["m1"]);
  });

  it("resolving one reports a missing conflict instead of writing an empty collection", () => {
    const harness = makeHarness();
    seedHusk(harness.store);
    expect(() =>
      resolveConflict({
        mutationId: "husk",
        outbox: harness.outbox,
        store: harness.store,
        strategy: "useServer",
      })
    ).toThrow(/Conflict not found/);
  });

  it("pruneGhostConflicts removes them and keeps real conflicts", () => {
    const harness = makeHarness();
    seedConflict(harness);
    seedHusk(harness.store);
    expect(pruneGhostConflicts({store: harness.store})).toEqual(["husk"]);
    expect(harness.store.raw.getRowIds("_conflicts")).toEqual(["m1"]);
  });
});
