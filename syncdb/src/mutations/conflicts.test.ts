import {describe, expect, it} from "bun:test";

import {createSyncStore} from "../storage/store";
import {createConflictStore} from "./conflicts";

const makeStore = () => createSyncStore();

describe("createConflictStore", () => {
  it("captures a conflict with decoded local/server data", () => {
    const store = makeStore();
    const conflicts = createConflictStore({store: store.raw});
    const conflict = conflicts.capture({
      collection: "todos",
      entityId: "t1",
      localData: {title: "Mine"},
      mutationId: "m1",
      serverData: {title: "Server"},
    });

    expect(conflict.conflictId).toBeTruthy();
    expect(conflict.localData).toEqual({title: "Mine"});
    expect(conflict.serverData).toEqual({title: "Server"});
    expect(conflict.dismissed).toBe(false);
    expect(conflicts.count()).toBe(1);
  });

  it("lists and counts excluding dismissed by default", () => {
    const store = makeStore();
    const conflicts = createConflictStore({store: store.raw});
    conflicts.capture({
      collection: "todos",
      conflictId: "c1",
      entityId: "t1",
      localData: {},
      mutationId: "m1",
      serverData: {},
    });
    conflicts.capture({
      collection: "todos",
      conflictId: "c2",
      entityId: "t2",
      localData: {},
      mutationId: "m2",
      serverData: {},
    });

    conflicts.dismiss({conflictId: "c1"});
    expect(conflicts.count()).toBe(1);
    expect(conflicts.list().map((c) => c.conflictId)).toEqual(["c2"]);
    expect(conflicts.count({includeDismissed: true})).toBe(2);
    expect(conflicts.list({includeDismissed: true})).toHaveLength(2);
  });

  it("gets a conflict by id and returns undefined for missing", () => {
    const store = makeStore();
    const conflicts = createConflictStore({store: store.raw});
    conflicts.capture({
      collection: "todos",
      conflictId: "c1",
      entityId: "t1",
      localData: {a: 1},
      mutationId: "m1",
      serverData: {a: 2},
    });

    expect(conflicts.get({conflictId: "c1"})?.entityId).toBe("t1");
    expect(conflicts.get({conflictId: "missing"})).toBeUndefined();
  });

  it("round-trips serverVersion and dismiss on a missing id is a no-op", () => {
    const store = makeStore();
    const conflicts = createConflictStore({store: store.raw});
    conflicts.capture({
      collection: "todos",
      conflictId: "c1",
      entityId: "t1",
      localData: {},
      mutationId: "m1",
      serverData: {},
      serverVersion: "v7",
    });

    expect(conflicts.get({conflictId: "c1"})?.serverVersion).toBe("v7");
    expect(() => conflicts.dismiss({conflictId: "missing"})).not.toThrow();
  });

  it("recovers from a corrupt payload by returning empty data", () => {
    const store = makeStore();
    const conflicts = createConflictStore({store: store.raw});
    conflicts.capture({
      collection: "todos",
      conflictId: "c1",
      entityId: "t1",
      localData: {a: 1},
      mutationId: "m1",
      serverData: {a: 2},
    });
    store.raw.setCell("conflicts", "c1", "serverData", "{bad json");

    expect(conflicts.get({conflictId: "c1"})?.serverData).toEqual({});
  });

  it("removes and clears conflicts", () => {
    const store = makeStore();
    const conflicts = createConflictStore({store: store.raw});
    conflicts.capture({
      collection: "todos",
      conflictId: "c1",
      entityId: "t1",
      localData: {},
      mutationId: "m1",
      serverData: {},
    });
    conflicts.remove({conflictId: "c1"});
    expect(conflicts.get({conflictId: "c1"})).toBeUndefined();

    conflicts.capture({
      collection: "todos",
      conflictId: "c2",
      entityId: "t2",
      localData: {},
      mutationId: "m2",
      serverData: {},
    });
    conflicts.clear();
    expect(conflicts.count({includeDismissed: true})).toBe(0);
  });
});
