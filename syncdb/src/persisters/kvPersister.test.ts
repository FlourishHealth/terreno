import {describe, expect, it} from "bun:test";

import {createAesGcmCodec, createStaticKeyProvider, generateAesGcmKey} from "../crypto/aesGcmCodec";
import {createSyncStore} from "../storage/store";
import {createKvPersister, type KeyValueStorage} from "./kvPersister";

const createMemoryStorage = (): KeyValueStorage & {map: Map<string, string>} => {
  const map = new Map<string, string>();
  return {
    getItem: async (key: string): Promise<string | null> => map.get(key) ?? null,
    map,
    removeItem: async (key: string): Promise<void> => {
      map.delete(key);
    },
    setItem: async (key: string, value: string): Promise<void> => {
      map.set(key, value);
    },
  };
};

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe("createKvPersister", () => {
  it("round-trips store content through shared storage", async () => {
    const storage = createMemoryStorage();

    const storeA = createSyncStore();
    storeA.upsertEntity({collection: "todos", data: {title: "kv"}, id: "t1"});
    const persisterA = createKvPersister({key: "db", storage, store: storeA.raw});
    await persisterA.save();

    const storeB = createSyncStore();
    const persisterB = createKvPersister({key: "db", storage, store: storeB.raw});
    await persisterB.load();
    expect(storeB.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "kv"});
  });

  it("encrypts at rest with a codec and decrypts on load", async () => {
    const storage = createMemoryStorage();
    const codec = createAesGcmCodec({
      keyProvider: createStaticKeyProvider(await generateAesGcmKey()),
    });

    const storeA = createSyncStore();
    storeA.upsertEntity({collection: "todos", data: {title: "classified"}, id: "t1"});
    const persisterA = createKvPersister({codec, key: "db", storage, store: storeA.raw});
    await persisterA.save();

    expect(storage.map.get("db")).toBeTruthy();
    expect(storage.map.get("db")).not.toContain("classified");

    const storeB = createSyncStore();
    const persisterB = createKvPersister({codec, key: "db", storage, store: storeB.raw});
    await persisterB.load();
    expect(storeB.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "classified"});
  });

  it("load is a no-op when storage is empty", async () => {
    const store = createSyncStore();
    const persister = createKvPersister({
      key: "db",
      storage: createMemoryStorage(),
      store: store.raw,
    });
    await persister.load();
    expect(store.getCollectionEntities({collection: "todos"})).toEqual([]);
  });

  it("auto-save persists subsequent changes and stops on destroy", async () => {
    const storage = createMemoryStorage();
    const storeA = createSyncStore();
    const persisterA = createKvPersister({key: "db", storage, store: storeA.raw});
    await persisterA.startAutoSave();
    storeA.upsertEntity({collection: "todos", data: {title: "auto"}, id: "t1"});
    await flush();

    const storeB = createSyncStore();
    const persisterB = createKvPersister({key: "db", storage, store: storeB.raw});
    await persisterB.load();
    expect(storeB.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "auto"});

    persisterA.destroy();
    storeA.upsertEntity({collection: "todos", data: {title: "after"}, id: "t2"});
    await flush();

    const storeC = createSyncStore();
    const persisterC = createKvPersister({key: "db", storage, store: storeC.raw});
    await persisterC.load();
    expect(storeC.getEntity({collection: "todos", id: "t2"})).toBeUndefined();
  });
});
