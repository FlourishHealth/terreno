import "fake-indexeddb/auto";

import {describe, expect, it, mock} from "bun:test";

import {createLocalKeyProvider} from "../crypto/keyProviders";
import {idbSet} from "../storage/idb";
import {createSyncStore, type SyncStore} from "../storage/store";
import {createDefaultPersisterFactory as createBaseFactory} from "./defaultPersisterFactory";
import {createDefaultPersisterFactory as createWebFactory} from "./defaultPersisterFactory.web";

let dbCounter = 0;
const uniqueDbName = (): string => `default-factory-test-${Date.now()}-${dbCounter++}`;

const makeStore = (): SyncStore => createSyncStore({collections: ["todos"]});

/** Read the raw persisted record via the plain IndexedDB API. */
const readRawRecord = (databaseName: string): Promise<unknown> =>
  new Promise((resolve, reject) => {
    const open = indexedDB.open(databaseName);
    open.onerror = (): void => reject(open.error);
    open.onsuccess = (): void => {
      const db = open.result;
      const request = db.transaction("kv", "readonly").objectStore("kv").get("content");
      request.onsuccess = (): void => {
        db.close();
        resolve(request.result);
      };
      request.onerror = (): void => {
        db.close();
        reject(request.error);
      };
    };
  });

describe("createDefaultPersisterFactory (base)", () => {
  it("falls back to the in-memory persister and round-trips across stores", async () => {
    const factory = createBaseFactory();
    const databaseName = uniqueDbName();
    const source = makeStore();
    source.upsertEntity({collection: "todos", data: {title: "ssr"}, id: "t1"});
    await factory({databaseName, store: source.raw}).save();

    const target = makeStore();
    await factory({databaseName, store: target.raw}).load();
    expect(target.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "ssr"});
  });
});

describe("createDefaultPersisterFactory (web)", () => {
  it("encrypts at rest by default (no config)", async () => {
    const databaseName = uniqueDbName();
    const factory = createWebFactory({saveDebounceMs: 0});
    const source = makeStore();
    source.upsertEntity({collection: "todos", data: {title: "SECRET_MARKER_XYZ"}, id: "t1"});
    await factory({databaseName, store: source.raw}).save();

    const raw = await readRawRecord(databaseName);
    expect(raw).toBeInstanceOf(Uint8Array);
    const asLatin1 = Array.from(raw as Uint8Array, (b) => String.fromCharCode(b)).join("");
    expect(asLatin1).not.toContain("SECRET_MARKER_XYZ");

    // Same factory (same key provider instance) loads it back into a new store.
    const target = makeStore();
    await factory({databaseName, store: target.raw}).load();
    expect(target.getEntity({collection: "todos", id: "t1"})?.data).toEqual({
      title: "SECRET_MARKER_XYZ",
    });
  });

  it("round-trips across factory instances sharing a keyProvider and userId", async () => {
    const keyProvider = createLocalKeyProvider({cacheDbName: uniqueDbName()});
    const databaseName = uniqueDbName();
    const source = makeStore();
    source.upsertEntity({collection: "todos", data: {title: "shared"}, id: "t1"});
    await createWebFactory({keyProvider, saveDebounceMs: 0, userId: "u1"})({
      databaseName,
      store: source.raw,
    }).save();

    const target = makeStore();
    await createWebFactory({keyProvider, saveDebounceMs: 0, userId: "u1"})({
      databaseName,
      store: target.raw,
    }).load();
    expect(target.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "shared"});
  });

  it("wires onDecryptFailure through to the encrypted persister", async () => {
    const databaseName = uniqueDbName();
    await idbSet({
      databaseName,
      key: "content",
      value: crypto.getRandomValues(new Uint8Array(48)),
    });
    const onDecryptFailure = mock(() => {});
    const store = makeStore();
    await createWebFactory({onDecryptFailure, saveDebounceMs: 0})({
      databaseName,
      store: store.raw,
    }).load();
    expect(onDecryptFailure).toHaveBeenCalledTimes(1);
    expect(store.listEntities({collection: "todos"})).toEqual([]);
  });

  it("cannot decrypt another user's persisted data (key scoping)", async () => {
    const keyProvider = createLocalKeyProvider({cacheDbName: uniqueDbName()});
    const databaseName = uniqueDbName();
    const source = makeStore();
    source.upsertEntity({collection: "todos", data: {title: "mine"}, id: "t1"});
    await createWebFactory({keyProvider, saveDebounceMs: 0, userId: "u1"})({
      databaseName,
      store: source.raw,
    }).save();

    const onDecryptFailure = mock(() => {});
    const target = makeStore();
    await createWebFactory({keyProvider, onDecryptFailure, saveDebounceMs: 0, userId: "u2"})({
      databaseName,
      store: target.raw,
    }).load();
    expect(onDecryptFailure).toHaveBeenCalledTimes(1);
    expect(target.listEntities({collection: "todos"})).toEqual([]);
  });

  it("tags the returned persister with persistenceMode: 'durable' when IndexedDB is available", () => {
    const persister = createWebFactory({saveDebounceMs: 0})({
      databaseName: uniqueDbName(),
      store: makeStore().raw,
    });
    expect((persister as unknown as {persistenceMode?: string}).persistenceMode).toBe("durable");
  });

  it("falls back to the in-memory persister and tags persistenceMode: 'memory' when indexedDB is unavailable (E3c)", async () => {
    const originalIndexedDb = globalThis.indexedDB;
    // Simulating an environment with no IndexedDB at all.
    delete (globalThis as {indexedDB?: unknown}).indexedDB;
    try {
      const databaseName = uniqueDbName();
      const source = makeStore();
      source.upsertEntity({collection: "todos", data: {title: "memory only"}, id: "t1"});
      const persister = createWebFactory({saveDebounceMs: 0})({
        databaseName,
        store: source.raw,
      });
      expect((persister as unknown as {persistenceMode?: string}).persistenceMode).toBe("memory");
      await persister.save();

      // The same databaseName round-trips through the in-memory backing —
      // proving the fallback is a real, working persister, not a stub.
      const target = makeStore();
      const targetPersister = createWebFactory({saveDebounceMs: 0})({
        databaseName,
        store: target.raw,
      });
      expect((targetPersister as unknown as {persistenceMode?: string}).persistenceMode).toBe(
        "memory"
      );
      await targetPersister.load();
      expect(target.getEntity({collection: "todos", id: "t1"})?.data).toEqual({
        title: "memory only",
      });
    } finally {
      globalThis.indexedDB = originalIndexedDb;
    }
  });
});
