import "fake-indexeddb/auto";

import {describe, expect, it} from "bun:test";

import {deleteIdbDatabase, idbDelete, idbGet, idbSet} from "./idb";

let dbCounter = 0;
const uniqueDbName = (): string => `idb-test-${Date.now()}-${dbCounter++}`;

const withoutIndexedDb = async (run: () => Promise<void>): Promise<void> => {
  const original = globalThis.indexedDB;
  // biome-ignore lint/suspicious/noExplicitAny: deliberately unsetting a global for the failure-path test
  (globalThis as any).indexedDB = undefined;
  try {
    await run();
  } finally {
    // biome-ignore lint/suspicious/noExplicitAny: restoring the global
    (globalThis as any).indexedDB = original;
  }
};

describe("idbSet / idbGet", () => {
  it("round-trips structured-cloneable values", async () => {
    const databaseName = uniqueDbName();
    await idbSet({databaseName, key: "blob", value: new Uint8Array([7, 8, 9])});
    const value = await idbGet<Uint8Array>({databaseName, key: "blob"});
    expect(value).toBeInstanceOf(Uint8Array);
    expect(Array.from(value as Uint8Array)).toEqual([7, 8, 9]);
  });

  it("returns undefined for a key that was never written", async () => {
    expect(await idbGet({databaseName: uniqueDbName(), key: "missing"})).toBeUndefined();
  });

  it("overwrites an existing key", async () => {
    const databaseName = uniqueDbName();
    await idbSet({databaseName, key: "k", value: "first"});
    await idbSet({databaseName, key: "k", value: "second"});
    expect(await idbGet<string>({databaseName, key: "k"})).toBe("second");
  });
});

describe("idbDelete", () => {
  it("removes a single key", async () => {
    const databaseName = uniqueDbName();
    await idbSet({databaseName, key: "k", value: "v"});
    await idbDelete({databaseName, key: "k"});
    expect(await idbGet({databaseName, key: "k"})).toBeUndefined();
  });

  it("is a no-op for an absent key", async () => {
    const databaseName = uniqueDbName();
    await idbDelete({databaseName, key: "never-written"});
    expect(await idbGet({databaseName, key: "never-written"})).toBeUndefined();
  });
});

describe("deleteIdbDatabase", () => {
  it("removes every record in the database", async () => {
    const databaseName = uniqueDbName();
    await idbSet({databaseName, key: "k", value: "v"});
    await deleteIdbDatabase({databaseName});
    expect(await idbGet({databaseName, key: "k"})).toBeUndefined();
  });

  it("resolves when the deletion is blocked by an open connection", async () => {
    const databaseName = uniqueDbName();
    await idbSet({databaseName, key: "k", value: "v"});
    // Hold a connection open (and ignore versionchange) so the delete blocks.
    const connection = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onsuccess = (): void => resolve(request.result);
      request.onerror = (): void => reject(request.error);
    });
    await deleteIdbDatabase({databaseName});
    connection.close();
  });
});

describe("open failures", () => {
  it("rejects when the database exists at a newer version", async () => {
    const databaseName = uniqueDbName();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 2);
      request.onupgradeneeded = (): void => {
        request.result.createObjectStore("kv");
      };
      request.onsuccess = (): void => {
        request.result.close();
        resolve();
      };
      request.onerror = (): void => reject(request.error);
    });
    // idb helpers always open version 1; an existing v2 database must fail
    // loudly instead of silently clobbering it.
    expect(idbGet({databaseName, key: "k"})).rejects.toThrow();
  });
});

describe("without IndexedDB available", () => {
  it("idbGet rejects with a clear error", async () => {
    await withoutIndexedDb(async () => {
      expect(idbGet({databaseName: "x", key: "k"})).rejects.toThrow(
        "IndexedDB is unavailable in this environment"
      );
    });
  });

  it("deleteIdbDatabase rejects with a clear error", async () => {
    await withoutIndexedDb(async () => {
      expect(deleteIdbDatabase({databaseName: "x"})).rejects.toThrow(
        "IndexedDB is unavailable in this environment"
      );
    });
  });
});
