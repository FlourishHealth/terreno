import {describe, expect, it} from "bun:test";

import {createSyncStore} from "../storage/store";
import {createConflictStore} from "./conflicts";
import {createOutbox} from "./outbox";
import {createConflictResolver} from "./resolveConflict";

const setup = () => {
  const store = createSyncStore();
  const outbox = createOutbox({store: store.raw});
  const conflicts = createConflictStore({store: store.raw});
  const resolver = createConflictResolver({conflicts, outbox, store});

  store.upsertEntity({collection: "todos", data: {title: "Mine"}, id: "t1"});
  outbox.enqueue({
    args: {title: "Mine"},
    collection: "todos",
    entityId: "t1",
    mutationId: "m1",
    operation: "update",
  });
  outbox.markInFlight({mutationId: "m1"});
  outbox.markConflicted({mutationId: "m1"});
  conflicts.capture({
    collection: "todos",
    conflictId: "c1",
    entityId: "t1",
    localData: {title: "Mine"},
    mutationId: "m1",
    serverData: {title: "Server", version: "v2"},
  });

  return {conflicts, outbox, resolver, store};
};

describe("createConflictResolver", () => {
  it("useServer applies server data, drops the mutation, and clears the conflict", () => {
    const {conflicts, outbox, resolver, store} = setup();

    resolver.resolve({conflictId: "c1", strategy: "useServer"});

    expect(store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({
      title: "Server",
      version: "v2",
    });
    expect(outbox.get({mutationId: "m1"})).toBeUndefined();
    expect(conflicts.get({conflictId: "c1"})).toBeUndefined();
  });

  it("keepMine requeues the mutation for replay and clears the conflict", () => {
    const {conflicts, outbox, resolver, store} = setup();

    resolver.resolve({conflictId: "c1", strategy: "keepMine"});

    expect(outbox.get({mutationId: "m1"})?.status).toBe("queued");
    expect(store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "Mine"});
    expect(conflicts.get({conflictId: "c1"})).toBeUndefined();
  });

  it("throws when resolving an unknown conflict", () => {
    const {resolver} = setup();
    expect(() => resolver.resolve({conflictId: "missing", strategy: "useServer"})).toThrow();
  });
});
