import {describe, expect, it} from "bun:test";

import {createSyncDbClient} from "./client";
import {createMemoryPersisterFactory, type MemoryStorage} from "./persisters/memoryPersister";
import {SYNC_TABLES} from "./storage/types";
import {createFakeTransport} from "./sync/fakeTransport";

describe("createSyncDbClient", () => {
  it("exposes a started status with zero counts by default", async () => {
    const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
    await client.start();

    const status = client.getSyncStatus();
    expect(status).toEqual({
      authBlocked: false,
      conflictCount: 0,
      failedCount: 0,
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

  it("excludes conflicted/failed mutations from queuedCount", async () => {
    const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
    await client.start();
    client.outbox.enqueue({args: {}, collection: "todos", mutationId: "q", operation: "create"});
    client.outbox.enqueue({args: {}, collection: "todos", mutationId: "f", operation: "create"});
    client.outbox.markInFlight({mutationId: "f"});
    client.outbox.markFailed({mutationId: "f"});

    // Only the queued mutation counts; the failed one is surfaced separately.
    expect(client.getSyncStatus().queuedCount).toBe(1);
    expect(client.getSyncStatus().failedCount).toBe(1);
    await client.destroy();
  });

  it("keeps notifying status listeners after a destroy/restart cycle", async () => {
    const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
    await client.start();
    let calls = 0;
    client.addStatusListener(() => {
      calls += 1;
    });

    await client.destroy();
    await client.start();
    const before = calls;
    client.outbox.enqueue({args: {}, collection: "todos", operation: "create"});
    expect(calls).toBeGreaterThan(before);
    await client.destroy();
  });

  it("notifies status listeners when the outbox changes", async () => {
    const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
    await client.start();
    let calls = 0;
    client.addStatusListener(() => {
      calls += 1;
    });
    client.outbox.enqueue({args: {}, collection: "todos", operation: "create"});
    expect(calls).toBeGreaterThanOrEqual(1);
    await client.destroy();
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

  it("connectSync replays queued mutations and applies inbound deltas", async () => {
    const transport = createFakeTransport();
    const client = createSyncDbClient({
      persisterFactory: createMemoryPersisterFactory(),
      transport,
    });
    await client.start();
    client.outbox.enqueue({
      args: {title: "offline"},
      collection: "todos",
      entityId: "t1",
      mutationId: "m1",
      operation: "create",
    });

    await client.connectSync();

    // Connecting replays the queued mutation.
    expect(transport.sent).toHaveLength(1);
    expect(client.getSyncStatus().isOnline).toBe(true);
    expect(client.getSyncStatus().isSyncing).toBe(true);

    // Server acks it -> queue drains, syncing clears.
    transport.emit({mutationId: "m1", type: "sync:ack"});
    expect(client.getSyncStatus().queuedCount).toBe(0);
    expect(client.getSyncStatus().isSyncing).toBe(false);

    // Inbound delta updates the local store.
    transport.emit({
      changes: [{collection: "todos", data: {title: "from server"}, entityId: "t2", op: "upsert"}],
      cursor: "1",
      stream: "todos",
      type: "sync:delta",
    });
    expect(client.store.getEntity({collection: "todos", id: "t2"})?.data).toEqual({
      title: "from server",
    });
    await client.destroy();
  });

  it("conflict nack surfaces a conflict that resolveConflict can clear", async () => {
    const transport = createFakeTransport();
    const client = createSyncDbClient({
      persisterFactory: createMemoryPersisterFactory(),
      transport,
    });
    await client.start();
    client.store.upsertEntity({collection: "todos", data: {title: "Mine"}, id: "t1"});
    client.outbox.enqueue({
      args: {title: "Mine"},
      collection: "todos",
      entityId: "t1",
      mutationId: "m1",
      operation: "update",
    });
    await client.connectSync();
    transport.emit({
      mutationId: "m1",
      reason: "conflict",
      serverData: {title: "Server"},
      type: "sync:nack",
    });

    expect(client.getSyncStatus().conflictCount).toBe(1);
    const [conflict] = client.conflicts.list();
    client.resolveConflict({conflictId: conflict.conflictId, strategy: "useServer"});

    expect(client.getSyncStatus().conflictCount).toBe(0);
    expect(client.store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({
      title: "Server",
    });
    await client.destroy();
  });

  it("auth nack pauses replay without clearing the queue", async () => {
    const transport = createFakeTransport();
    const client = createSyncDbClient({
      persisterFactory: createMemoryPersisterFactory(),
      transport,
    });
    await client.start();
    client.outbox.enqueue({
      args: {title: "x"},
      collection: "todos",
      entityId: "t1",
      mutationId: "m1",
      operation: "create",
    });
    await client.connectSync();
    transport.emit({mutationId: "m1", reason: "auth", type: "sync:nack"});

    const statusAfter = client.getSyncStatus();
    expect(statusAfter.authBlocked).toBe(true);
    expect(statusAfter.queuedCount).toBe(1);
    await client.destroy();
  });

  it("requeues in-flight mutations on disconnect and replays them on reconnect", async () => {
    const transport = createFakeTransport();
    const client = createSyncDbClient({
      persisterFactory: createMemoryPersisterFactory(),
      transport,
    });
    await client.start();
    client.outbox.enqueue({
      args: {title: "x"},
      collection: "todos",
      entityId: "t1",
      mutationId: "m1",
      operation: "create",
    });
    await client.connectSync();
    // In flight, no ack yet.
    expect(client.outbox.get({mutationId: "m1"})?.status).toBe("inFlight");

    client.disconnectSync();
    expect(client.getSyncStatus().isOnline).toBe(false);
    // Not stranded: returned to the queue.
    expect(client.outbox.get({mutationId: "m1"})?.status).toBe("queued");

    await client.connectSync();
    transport.emit({mutationId: "m1", type: "sync:ack"});
    expect(client.outbox.get({mutationId: "m1"})).toBeUndefined();
    await client.destroy();
  });

  it("pauses replay while auth-blocked and resumes after reconnect", async () => {
    const transport = createFakeTransport();
    const client = createSyncDbClient({
      persisterFactory: createMemoryPersisterFactory(),
      transport,
    });
    await client.start();
    client.outbox.enqueue({
      args: {},
      collection: "todos",
      entityId: "t1",
      mutationId: "m1",
      operation: "create",
    });
    await client.connectSync();
    transport.emit({mutationId: "m1", reason: "auth", type: "sync:nack"});
    expect(client.getSyncStatus().authBlocked).toBe(true);

    // A new mutation + replay must NOT send while auth is blocked.
    const sentBefore = transport.sent.length;
    client.outbox.enqueue({args: {}, collection: "todos", mutationId: "m2", operation: "create"});
    client.replayOutbox();
    expect(transport.sent.length).toBe(sentBefore);

    // Reconnect clears auth-block and replays the backlog.
    client.disconnectSync();
    await client.connectSync();
    expect(client.getSyncStatus().authBlocked).toBe(false);
    expect(transport.sent.length).toBeGreaterThan(sentBefore);
    await client.destroy();
  });

  it("hydrate downloads and mirrors collections into the local store", async () => {
    const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
    await client.start();

    const seen: Array<{collection: string; since?: string}> = [];
    const fetcher = async ({collection, since}: {collection: string; since?: string}) => {
      seen.push({collection, since});
      return {
        collection,
        cursor: "10",
        records: [{data: {title: `${collection}-1`}, id: `${collection}-1`, version: "v1"}],
      };
    };

    const results = await client.hydrate({collections: ["todos", "todoLists"], fetcher});

    expect(results).toHaveLength(2);
    expect(seen.map((s) => s.collection)).toEqual(["todos", "todoLists"]);
    expect(client.store.getEntity({collection: "todos", id: "todos-1"})?.data).toEqual({
      title: "todos-1",
    });
    expect(client.store.getEntity({collection: "todoLists", id: "todoLists-1"})).toBeDefined();
    await client.destroy();
  });

  it("hydrate does not overwrite entities with pending local mutations", async () => {
    const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
    await client.start();
    // Optimistic local edit + queued mutation for t1.
    client.store.upsertEntity({collection: "todos", data: {title: "my local edit"}, id: "t1"});
    client.outbox.enqueue({
      args: {title: "my local edit"},
      collection: "todos",
      entityId: "t1",
      operation: "update",
    });

    await client.hydrate({
      collections: ["todos"],
      fetcher: async () => ({
        collection: "todos",
        records: [
          {data: {title: "stale server value"}, id: "t1"},
          {data: {title: "other"}, id: "t2"},
        ],
      }),
    });

    // t1 keeps the local edit; t2 (no pending mutation) is mirrored.
    expect(client.store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({
      title: "my local edit",
    });
    expect(client.store.getEntity({collection: "todos", id: "t2"})?.data).toEqual({title: "other"});
    await client.destroy();
  });

  it("hydrate passes the known cursor as `since` for incremental prefetch", async () => {
    const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
    await client.start();
    client.deltaApplier.apply({
      changes: [{collection: "todos", data: {}, entityId: "seed", op: "upsert"}],
      cursor: "7",
      stream: "todos",
      type: "sync:delta",
    });

    let receivedSince: string | undefined;
    await client.hydrate({
      collections: ["todos"],
      fetcher: async ({since}) => {
        receivedSince = since;
        return {collection: "todos", records: []};
      },
    });

    expect(receivedSince).toBe("7");
    await client.destroy();
  });

  it("connectSync throws without a configured transport", async () => {
    const client = createSyncDbClient({persisterFactory: createMemoryPersisterFactory()});
    await client.start();
    await expect(client.connectSync()).rejects.toThrow();
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
