import "fake-indexeddb/auto";

import {describe, expect, it} from "bun:test";

import {createAesGcmCodec} from "../crypto/aesGcmCodec";
import {createLocalKeyProvider} from "../crypto/keyProviders";
import {createOutbox} from "../mutations/outbox";
import {createEncryptedIndexedDbPersister} from "../persisters/encryptedIndexedDbPersister";
import {createMemoryPersister} from "../persisters/memoryPersister";
import {idbGet} from "./idb";
import {SYNC_SCHEMA_VERSION} from "./schema";
import {createSyncStore, type SyncStore} from "./store";
import {OUTBOX_TABLE} from "./types";
import {wipeLocalData} from "./wipe";

let dbCounter = 0;
const uniqueDbName = (): string => `wipe-test-${Date.now()}-${dbCounter++}`;

const makeSeededStore = (): SyncStore => {
  const store = createSyncStore({collections: ["todos"]});
  store.upsertEntity({collection: "todos", data: {title: "secret"}, id: "t1", seq: 2});
  store.setLastUserId({userId: "u1"});
  createOutbox({store}).enqueue({
    args: {title: "secret"},
    collection: "todos",
    entityId: "t1",
    mutationId: "m1",
    operation: "create",
    userId: "u1",
  });
  return store;
};

describe("wipeLocalData", () => {
  it("clears every table and resets values on the store", async () => {
    const store = makeSeededStore();
    await wipeLocalData({store});
    expect(store.listEntities({collection: "todos", includeDeleted: true})).toEqual([]);
    expect(store.raw.getRowIds(OUTBOX_TABLE)).toEqual([]);
    expect(store.raw.getTables()).toEqual({});
    expect(store.getLastUserId()).toBeUndefined();
    expect(store.getSchemaVersion()).toBe(SYNC_SCHEMA_VERSION);
  });

  it("overwrites the persisted snapshot so a reload yields an empty store", async () => {
    const databaseName = uniqueDbName();
    const codec = createAesGcmCodec({
      key: await crypto.subtle.generateKey({length: 256, name: "AES-GCM"}, false, [
        "encrypt",
        "decrypt",
      ]),
    });
    const store = makeSeededStore();
    const persister = createEncryptedIndexedDbPersister({
      codec,
      databaseName,
      saveDebounceMs: 0,
      store: store.raw,
    });
    await persister.save();

    await wipeLocalData({databaseNames: [databaseName], persister, store});

    // The persisted blob is gone entirely — not just overwritten.
    expect(await idbGet({databaseName, key: "content"})).toBeUndefined();

    const reloaded = createSyncStore({collections: ["todos"]});
    await createEncryptedIndexedDbPersister({
      codec,
      databaseName,
      saveDebounceMs: 0,
      store: reloaded.raw,
    }).load();
    expect(reloaded.listEntities({collection: "todos", includeDeleted: true})).toEqual([]);
    expect(reloaded.raw.getRowIds(OUTBOX_TABLE)).toEqual([]);
    expect(reloaded.getLastUserId()).toBeUndefined();
  });

  it("stops a running autosave via persister.destroy", async () => {
    const databaseName = uniqueDbName();
    const store = makeSeededStore();
    const persister = createMemoryPersister({databaseName, store: store.raw});
    await persister.startAutoSave();
    await wipeLocalData({databaseNames: [databaseName], persister, store});
    // Post-wipe writes must not be persisted (listeners removed).
    store.upsertEntity({collection: "todos", data: {title: "after"}, id: "t2"});
    const reloaded = createSyncStore({collections: ["todos"]});
    await createMemoryPersister({databaseName, store: reloaded.raw}).load();
    expect(reloaded.listEntities({collection: "todos"})).toEqual([]);
  });

  it("deletes cached encryption keys", async () => {
    const keyCacheDbName = uniqueDbName();
    const keyProvider = createLocalKeyProvider({cacheDbName: keyCacheDbName});
    await keyProvider.getKey({userId: "u1"});
    expect(await idbGet<CryptoKey>({databaseName: keyCacheDbName, key: "local:u1"})).toBeInstanceOf(
      CryptoKey
    );

    await wipeLocalData({keyCacheDbNames: [keyCacheDbName], store: makeSeededStore()});
    expect(
      await idbGet<CryptoKey>({databaseName: keyCacheDbName, key: "local:u1"})
    ).toBeUndefined();
  });

  it("works with no persister and no key caches", async () => {
    const store = makeSeededStore();
    await wipeLocalData({store});
    expect(store.raw.getTables()).toEqual({});
  });
});
