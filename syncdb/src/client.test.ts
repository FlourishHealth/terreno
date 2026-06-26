import {describe, expect, it} from "bun:test";

import {createSyncDbClient} from "./client";
import {createMemoryPersisterFactory, type MemoryStorage} from "./persisters/memoryPersister";
import {SYNC_TABLES} from "./storage/types";

describe("createSyncDbClient", () => {
  it("exposes a started status with zero counts by default", async () => {
    const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
    await client.start();

    const status = client.getSyncStatus();
    expect(status).toEqual({
      authBlocked: false,
      conflictCount: 0,
      isOnline: true,
      isSyncing: false,
      queuedCount: 0,
    });
    await client.destroy();
  });

  it("loads persisted content on start and persists via auto-save", async () => {
    const backing: MemoryStorage = {};
    const factory = createMemoryPersisterFactory(backing);

    const first = createSyncDbClient({persisterFactory: factory});
    await first.start();
    first.store.upsertEntity({collection: "todos", data: {title: "offline task"}, id: "t1"});
    first.outbox.enqueue({args: {title: "offline task"}, collection: "todos", operation: "create"});
    await first.destroy();

    const second = createSyncDbClient({persisterFactory: factory});
    await second.start();
    expect(second.store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({
      title: "offline task",
    });
    expect(second.getSyncStatus().queuedCount).toBe(1);
    await second.destroy();
  });

  it("reflects queued and conflict counts in sync status", async () => {
    const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
    await client.start();
    client.outbox.enqueue({args: {}, collection: "todos", operation: "create"});
    client.store.raw.setRow(SYNC_TABLES.conflicts, "c1", {
      collection: "todos",
      createdAt: "2026-01-01T00:00:00.000Z",
      dismissed: false,
      entityId: "t1",
      localData: "{}",
      mutationId: "m1",
      serverData: "{}",
    });

    const status = client.getSyncStatus();
    expect(status.queuedCount).toBe(1);
    expect(status.conflictCount).toBe(1);
    await client.destroy();
  });

  it("drives network/syncing/auth-blocked status via setters", async () => {
    const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
    await client.start();

    client.setOnline({isOnline: false});
    client.setSyncing({isSyncing: true});
    client.setAuthBlocked({authBlocked: true});

    const status = client.getSyncStatus();
    expect(status.isOnline).toBe(false);
    expect(status.isSyncing).toBe(true);
    expect(status.authBlocked).toBe(true);
    await client.destroy();
  });

  it("excludes dismissed conflicts from the count", async () => {
    const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
    await client.start();
    client.store.raw.setRow(SYNC_TABLES.conflicts, "c1", {
      collection: "todos",
      createdAt: "2026-01-01T00:00:00.000Z",
      dismissed: true,
      entityId: "t1",
      localData: "{}",
      mutationId: "m1",
      serverData: "{}",
    });

    expect(client.getSyncStatus().conflictCount).toBe(0);
    await client.destroy();
  });

  it("notifies status listeners and supports unsubscribe", async () => {
    const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
    await client.start();

    const seen: boolean[] = [];
    const unsubscribe = client.addStatusListener((status) => {
      seen.push(status.isOnline);
    });
    client.setOnline({isOnline: false});
    unsubscribe();
    client.setOnline({isOnline: true});

    expect(seen).toEqual([false]);
    await client.destroy();
  });

  it("throws when saving before start", async () => {
    const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
    await expect(client.save()).rejects.toThrow();
  });

  it("does not auto-persist when autoSave is false but explicit save works", async () => {
    const backing: MemoryStorage = {};
    const factory = createMemoryPersisterFactory(backing);

    const client = createSyncDbClient({autoSave: false, persisterFactory: factory});
    await client.start();
    client.store.upsertEntity({collection: "todos", data: {title: "manual"}, id: "t1"});

    const beforeSave = createSyncDbClient({persisterFactory: factory});
    await beforeSave.start();
    expect(beforeSave.store.getEntity({collection: "todos", id: "t1"})).toBeUndefined();
    await beforeSave.destroy();

    await client.save();
    const afterSave = createSyncDbClient({persisterFactory: factory});
    await afterSave.start();
    expect(afterSave.store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({
      title: "manual",
    });
    await afterSave.destroy();
    await client.destroy();
  });

  it("initializes the persister exactly once across concurrent and repeat start() calls", async () => {
    const inner = createMemoryPersisterFactory();
    let factoryCalls = 0;
    const countingFactory = (store: Parameters<typeof inner>[0]) => {
      factoryCalls += 1;
      return inner(store);
    };

    const client = createSyncDbClient({persisterFactory: countingFactory});
    await Promise.all([client.start(), client.start()]);
    await client.start();

    expect(factoryCalls).toBe(1);
    await client.destroy();
  });

  it("uses the in-memory default persister factory when none is provided", async () => {
    const client = createSyncDbClient({databaseName: "syncdb-default-test"});
    await client.start();
    client.store.upsertEntity({collection: "todos", data: {title: "x"}, id: "t1"});
    expect(client.getSyncStatus().queuedCount).toBe(0);
    expect(client.store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "x"});
    await client.destroy();
  });

  it("supports restart after destroy and passes storeId through", async () => {
    const backing: MemoryStorage = {};
    const client = createSyncDbClient({
      persisterFactory: createMemoryPersisterFactory(backing),
      storeId: "deterministic",
    });
    await client.start();
    client.store.upsertEntity({collection: "todos", data: {title: "a"}, id: "t1"});
    await client.save();
    await client.destroy();

    await client.start();
    expect(client.store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({title: "a"});
    await client.destroy();
  });
});
