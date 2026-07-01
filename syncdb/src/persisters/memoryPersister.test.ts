import {describe, expect, it} from "bun:test";

import {createSyncStore} from "../storage/store";
import {createMemoryPersisterFactory, type MemoryStorage} from "./memoryPersister";

describe("memory persister", () => {
  it("round-trips store content into a separate store instance via shared backing", async () => {
    const backing: MemoryStorage = {};
    const factory = createMemoryPersisterFactory(backing);

    const storeA = createSyncStore();
    storeA.upsertEntity({collection: "todos", data: {title: "persist me"}, id: "t1"});
    const persisterA = await factory(storeA.raw);
    await persisterA.save();

    const storeB = createSyncStore();
    const persisterB = await factory(storeB.raw);
    await persisterB.load();

    expect(storeB.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "persist me"});
  });

  it("load is a no-op when nothing has been persisted", async () => {
    const factory = createMemoryPersisterFactory();
    const store = createSyncStore();
    const persister = await factory(store.raw);

    await persister.load();
    expect(store.getCollectionEntities({collection: "todos"})).toEqual([]);
  });

  it("auto-save persists subsequent mutations", async () => {
    const backing: MemoryStorage = {};
    const factory = createMemoryPersisterFactory(backing);

    const storeA = createSyncStore();
    const persisterA = await factory(storeA.raw);
    await persisterA.startAutoSave();
    storeA.upsertEntity({collection: "todos", data: {title: "auto"}, id: "t1"});

    const storeB = createSyncStore();
    const persisterB = await factory(storeB.raw);
    await persisterB.load();
    expect(storeB.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "auto"});

    persisterA.stopAutoSave();
    storeA.upsertEntity({collection: "todos", data: {title: "after-stop"}, id: "t2"});

    const storeC = createSyncStore();
    const persisterC = await factory(storeC.raw);
    await persisterC.load();
    expect(storeC.getEntity({collection: "todos", id: "t2"})).toBeUndefined();
  });

  it("destroy stops auto-save", async () => {
    const backing: MemoryStorage = {};
    const factory = createMemoryPersisterFactory(backing);

    const storeA = createSyncStore();
    const persisterA = await factory(storeA.raw);
    await persisterA.startAutoSave();
    persisterA.destroy();
    storeA.upsertEntity({collection: "todos", data: {title: "after-destroy"}, id: "t1"});

    const storeB = createSyncStore();
    const persisterB = await factory(storeB.raw);
    await persisterB.load();
    expect(storeB.getEntity({collection: "todos", id: "t1"})).toBeUndefined();
  });
});
