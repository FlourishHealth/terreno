import {describe, expect, it} from "bun:test";

import {createSyncStore, type SyncStore} from "../storage/store";
import {deleteConflict, getConflict, listConflicts, writeConflict} from "./conflicts";
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
    // The mutation stays conflicted — a terminal state that never replays.
    expect(harness.outbox.getMutation({mutationId: "m1"})?.status).toBe("conflicted");
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
