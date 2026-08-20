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

  // Task 9.12: a conflict whose server state is "no document at a real seq"
  // (deleted, hard-deleted, or moved out of the client's scope) must resolve to
  // a TOMBSTONE. Upserting null data over a live row instead leaves a ghost that
  // lists, renders, and syncs forever as an empty entity.
  describe("server-deleted conflicts (9.12)", () => {
    const seedServerDeleted = ({
      store,
      outbox,
      serverSeq,
      serverDeleted,
    }: {
      store: SyncStore;
      outbox: Outbox;
      serverSeq: number;
      serverDeleted?: boolean;
    }): void => {
      seedConflict({outbox, store});
      writeConflict({
        conflict: {
          collection: "todos",
          dismissed: false,
          entityId: "t1",
          localData: JSON.stringify({title: "local"}),
          mutationId: "m1",
          serverData: JSON.stringify(null),
          serverSeq,
          ...(serverDeleted === undefined ? {} : {serverDeleted}),
        },
        store,
      });
    };

    it("useServer upserts a tombstone when the server has no document at a real seq", () => {
      const harness = makeHarness();
      seedServerDeleted({...harness, serverSeq: 9});

      resolveConflict({
        mutationId: "m1",
        outbox: harness.outbox,
        store: harness.store,
        strategy: "useServer",
      });

      const entity = harness.store.getEntity({collection: "todos", id: "t1"});
      expect(entity?.deleted).toBe(true);
      expect(entity?.seq).toBe(9);
      expect(entity?.pendingMutationId).toBeUndefined();
      // A tombstone is excluded from live reads — no ghost row in the UI.
      expect(harness.store.listEntities({collection: "todos"})).toHaveLength(0);
    });

    it("useServer honors an explicit serverDeleted flag even at seq 0", () => {
      const harness = makeHarness();
      seedServerDeleted({...harness, serverDeleted: true, serverSeq: 0});

      resolveConflict({
        mutationId: "m1",
        outbox: harness.outbox,
        store: harness.store,
        strategy: "useServer",
      });
      expect(harness.store.getEntity({collection: "todos", id: "t1"})?.deleted).toBe(true);
    });

    // seq 0 with no flag is the startup-recovery husk shape (recoverStartupState
    // writes serverData null / serverSeq 0 for a conflicted row it never saw a
    // nack for). That is "server state unknown", NOT "server deleted" — deleting
    // the user's local data on it would be silent data loss.
    it("does not tombstone when serverData is null at seq 0 (server state unknown)", () => {
      const harness = makeHarness();
      seedServerDeleted({...harness, serverSeq: 0});

      resolveConflict({
        mutationId: "m1",
        outbox: harness.outbox,
        store: harness.store,
        strategy: "useServer",
      });
      const entity = harness.store.getEntity({collection: "todos", id: "t1"});
      expect(entity?.deleted).toBe(false);
      expect(entity?.data).toBeNull();
    });

    // The mirror image: a local DELETE that conflicts with a server edit. The
    // local row is already a tombstone, so accepting the server side has to
    // resurrect it — otherwise the live server document stays invisible locally
    // (and keeps arriving as a delta the tombstone hides) until a re-bootstrap.
    it("useServer resurrects a local tombstone when the server still has the document", () => {
      const harness = makeHarness();
      seedConflict(harness);
      harness.store.softDeleteEntity({collection: "todos", id: "t1"});
      expect(harness.store.getEntity({collection: "todos", id: "t1"})?.deleted).toBe(true);

      resolveConflict({
        mutationId: "m1",
        outbox: harness.outbox,
        store: harness.store,
        strategy: "useServer",
      });

      const entity = harness.store.getEntity({collection: "todos", id: "t1"});
      expect(entity?.deleted).toBe(false);
      expect(entity?.data).toEqual({title: "server"});
      expect(harness.store.listEntities({collection: "todos"})).toHaveLength(1);
    });

    it("keepMine still retries against the server seq for a server-deleted conflict", () => {
      const harness = makeHarness();
      seedServerDeleted({...harness, serverSeq: 9});

      resolveConflict({
        mutationId: "m1",
        outbox: harness.outbox,
        store: harness.store,
        strategy: "keepMine",
      });
      const entity = harness.store.getEntity({collection: "todos", id: "t1"});
      expect(entity?.deleted).toBe(false);
      expect(entity?.data).toEqual({title: "local"});
      expect(harness.outbox.listQueued({userId: USER})[0]?.baseVersion).toBe(9);
    });
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
