import {describe, expect, it} from "bun:test";

import {createOutbox} from "../mutations/outbox";
import {createSyncStore, type SyncStore} from "../storage/store";
import {OUTBOX_TABLE} from "../storage/types";
import {
  clearMemoryPersisterData,
  createMemoryPersister,
  memoryPersisterFactory,
} from "./memoryPersister";

let dbCounter = 0;
const uniqueDbName = (): string => `memory-test-${dbCounter++}`;

const makeStore = (): SyncStore => createSyncStore({collections: ["todos"]});

describe("createMemoryPersister", () => {
  it("round-trips entities and outbox rows across separate store instances", async () => {
    const databaseName = uniqueDbName();
    const source = makeStore();
    source.upsertEntity({collection: "todos", data: {title: "Buy milk"}, id: "t1", seq: 3});
    source.setLastUserId({userId: "u1"});
    createOutbox({store: source}).enqueue({
      args: {title: "Buy milk"},
      collection: "todos",
      entityId: "t1",
      mutationId: "m1",
      operation: "create",
      userId: "u1",
    });
    await createMemoryPersister({databaseName, store: source.raw}).save();

    const target = makeStore();
    await createMemoryPersister({databaseName, store: target.raw}).load();
    expect(target.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "Buy milk"});
    expect(target.getEntity({collection: "todos", id: "t1"})?.seq).toBe(3);
    expect(target.getLastUserId()).toBe("u1");
    const outboxRow = target.raw.getRow(OUTBOX_TABLE, "m1");
    expect(outboxRow.collection).toBe("todos");
    expect(outboxRow.status).toBe("queued");
  });

  it("loads nothing when the databaseName has never been saved", async () => {
    const store = makeStore();
    await createMemoryPersister({databaseName: uniqueDbName(), store: store.raw}).load();
    expect(store.listEntities({collection: "todos"})).toEqual([]);
  });

  it("isolates content between databaseNames", async () => {
    const dbA = uniqueDbName();
    const dbB = uniqueDbName();
    const storeA = makeStore();
    storeA.upsertEntity({collection: "todos", data: {title: "A"}, id: "a"});
    await createMemoryPersister({databaseName: dbA, store: storeA.raw}).save();
    const storeB = makeStore();
    storeB.upsertEntity({collection: "todos", data: {title: "B"}, id: "b"});
    await createMemoryPersister({databaseName: dbB, store: storeB.raw}).save();

    const reloaded = makeStore();
    await createMemoryPersister({databaseName: dbA, store: reloaded.raw}).load();
    expect(reloaded.getEntity({collection: "todos", id: "a"})).toBeDefined();
    expect(reloaded.getEntity({collection: "todos", id: "b"})).toBeUndefined();
  });

  it("persists store changes automatically under startAutoSave", async () => {
    const databaseName = uniqueDbName();
    const source = makeStore();
    const persister = createMemoryPersister({databaseName, store: source.raw});
    await persister.startAutoSave();
    source.upsertEntity({collection: "todos", data: {title: "auto"}, id: "t1"});
    await persister.destroy();

    const target = makeStore();
    await createMemoryPersister({databaseName, store: target.raw}).load();
    expect(target.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "auto"});
  });

  it("supports the autoLoad lifecycle (no external change source to observe)", async () => {
    const databaseName = uniqueDbName();
    const source = makeStore();
    source.upsertEntity({collection: "todos", data: {title: "autoload"}, id: "t1"});
    await createMemoryPersister({databaseName, store: source.raw}).save();

    const target = makeStore();
    const persister = createMemoryPersister({databaseName, store: target.raw});
    await persister.startAutoLoad();
    expect(target.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "autoload"});
    await persister.stopAutoLoad();
    await persister.destroy();
  });

  it("hands loads a deep copy, not a live reference into another store", async () => {
    const databaseName = uniqueDbName();
    const source = makeStore();
    source.upsertEntity({collection: "todos", data: {title: "original"}, id: "t1"});
    await createMemoryPersister({databaseName, store: source.raw}).save();

    const target = makeStore();
    await createMemoryPersister({databaseName, store: target.raw}).load();
    target.upsertEntity({collection: "todos", data: {title: "changed"}, id: "t1"});

    const reloaded = makeStore();
    await createMemoryPersister({databaseName, store: reloaded.raw}).load();
    expect(reloaded.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "original"});
  });
});

describe("memoryPersisterFactory", () => {
  it("builds persisters bound to the given store and databaseName", async () => {
    const databaseName = uniqueDbName();
    const source = makeStore();
    source.upsertEntity({collection: "todos", data: {title: "via factory"}, id: "t1"});
    await memoryPersisterFactory({databaseName, store: source.raw}).save();

    const target = makeStore();
    await memoryPersisterFactory({databaseName, store: target.raw}).load();
    expect(target.getEntity({collection: "todos", id: "t1"})?.data).toEqual({
      title: "via factory",
    });
  });
});

describe("clearMemoryPersisterData", () => {
  it("drops persisted content for one databaseName", async () => {
    const databaseName = uniqueDbName();
    const source = makeStore();
    source.upsertEntity({collection: "todos", data: {title: "gone"}, id: "t1"});
    await createMemoryPersister({databaseName, store: source.raw}).save();

    clearMemoryPersisterData({databaseName});

    const target = makeStore();
    await createMemoryPersister({databaseName, store: target.raw}).load();
    expect(target.listEntities({collection: "todos"})).toEqual([]);
  });
});
