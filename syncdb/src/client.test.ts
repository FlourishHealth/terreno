import {describe, expect, it} from "bun:test";

import {createSyncDb, type SyncDbConfig} from "./client";
import {getConflict} from "./mutations/conflicts";
import {memoryPersisterFactory} from "./persisters/memoryPersister";
import {createFakeTransport, type FakeTransport} from "./sync/fakeTransport";
import type {HttpChannel} from "./sync/httpChannel";
import type {AuthProvider, SyncDelta, SyncSnapshotResponse} from "./types";

let nameCounter = 0;
const uniqueName = (): string => {
  nameCounter += 1;
  return `client-test-${nameCounter}`;
};

const flush = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 5));
};

interface FakeAuth {
  provider: AuthProvider;
  setUserId: (userId: string | null) => void;
  emitAuthChange: () => void;
}

const makeAuthProvider = (initialUserId: string | null = "u1"): FakeAuth => {
  const listeners = new Set<() => void>();
  const state = {userId: initialUserId};
  return {
    emitAuthChange: (): void => {
      for (const listener of listeners) {
        listener();
      }
    },
    provider: {
      getToken: async () => "token",
      getUserId: async () => state.userId,
      onAuthChange: (callback: () => void): (() => void) => {
        listeners.add(callback);
        return () => {
          listeners.delete(callback);
        };
      },
    },
    setUserId: (userId: string | null): void => {
      state.userId = userId;
    },
  };
};

interface FakeChannel {
  channel: HttpChannel;
  state: {fetchCount: number; pages: Record<string, SyncSnapshotResponse>};
}

const makeChannel = (): FakeChannel => {
  const state: FakeChannel["state"] = {fetchCount: 0, pages: {}};
  return {
    channel: {
      fetchSnapshotPage: async ({collection}) => {
        state.fetchCount += 1;
        return state.pages[collection] ?? {cursor: 0, entities: [], hasMore: false};
      },
      sendMutation: async () => {
        throw new Error("HTTP mutate not expected in this test");
      },
    },
    state,
  };
};

interface Harness {
  auth: FakeAuth;
  transport: FakeTransport;
  http: FakeChannel;
  clock: {value: number};
  config: SyncDbConfig;
}

const makeHarness = (overrides: Partial<SyncDbConfig> = {}): Harness => {
  const auth = makeAuthProvider();
  const transport = createFakeTransport();
  const http = makeChannel();
  const clock = {value: 1_000_000};
  return {
    auth,
    clock,
    config: {
      authProvider: auth.provider,
      collections: ["todos"],
      httpChannel: http.channel,
      name: uniqueName(),
      now: () => clock.value,
      persisterFactory: memoryPersisterFactory,
      reconcileIntervalMs: 0,
      transport,
      ...overrides,
    },
    http,
    transport,
  };
};

const makeDelta = (overrides: Partial<SyncDelta> = {}): SyncDelta => ({
  collection: "todos",
  data: {title: "from server"},
  id: "t1",
  method: "create",
  seq: 1,
  stream: "todos|owner:u1",
  ...overrides,
});

describe("createSyncDb", () => {
  it("requires a transport or a baseUrl", () => {
    const auth = makeAuthProvider();
    expect(() =>
      createSyncDb({authProvider: auth.provider, collections: ["todos"], name: uniqueName()})
    ).toThrow("requires a transport or a baseUrl");
  });

  it("constructs default socket transport and http channel from baseUrl", () => {
    const auth = makeAuthProvider();
    const client = createSyncDb({
      authProvider: auth.provider,
      baseUrl: "http://127.0.0.1:9",
      collections: ["todos"],
      name: uniqueName(),
    });
    expect(client.getSyncStatus()).toEqual({
      conflictCount: 0,
      isOnline: false,
      isSyncing: false,
      queuedCount: 0,
      streams: {},
    });
  });

  it("start() rejects without an authenticated user", async () => {
    const harness = makeHarness();
    harness.auth.setUserId(null);
    const client = createSyncDb(harness.config);
    await expect(client.start()).rejects.toThrow("requires an authenticated user");
  });

  it("start() connects, subscribes the collections, and records the user", async () => {
    const harness = makeHarness();
    const client = createSyncDb(harness.config);
    await client.start();
    expect(harness.transport.subscribedCollections).toEqual(["todos"]);
    expect(client.store.getLastUserId()).toBe("u1");
    expect(client.getSyncStatus().isOnline).toBe(true);
    await client.stop();
  });

  it("start() succeeds when the transport cannot connect (offline start)", async () => {
    const harness = makeHarness();
    const offlineTransport: FakeTransport = {
      ...harness.transport,
      connect: async () => {
        throw new Error("no network");
      },
    };
    const client = createSyncDb({...harness.config, transport: offlineTransport});
    await client.start();
    expect(client.getSyncStatus().isOnline).toBe(false);
    await client.stop();
  });

  describe("mutate", () => {
    it("throws before start() and for updates/deletes without an id", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      expect(() => client.mutate({collection: "todos", operation: "create"})).toThrow(
        "requires start()"
      );
      await client.start();
      expect(() => client.mutate({collection: "todos", operation: "update"})).toThrow(
        "requires an id"
      );
      expect(() => client.mutate({collection: "todos", operation: "delete"})).toThrow(
        "requires an id"
      );
      await client.stop();
    });

    it("applies creates optimistically and immediately", async () => {
      const harness = makeHarness();
      // Hold replies so the pre-ack state is observable.
      harness.transport.setDefaultResponder(async () => {
        await flush();
        throw new Error("offline");
      });
      const client = createSyncDb(harness.config);
      await client.start();

      const {id, mutationId} = client.mutate({
        collection: "todos",
        data: {title: "buy milk"},
        operation: "create",
      });
      const entity = client.store.getEntity({collection: "todos", id});
      expect(entity?.data).toEqual({title: "buy milk"});
      expect(entity?.pendingMutationId).toBe(mutationId);
      expect(entity?.seq).toBe(0);
      expect(["inFlight", "queued"]).toContain(
        client.outbox.getMutation({mutationId})?.status ?? "missing"
      );
      await client.stop();
    });

    it("acked mutations clear pendingMutationId and stamp the server seq", async () => {
      const harness = makeHarness();
      harness.transport.respondWithAck({seq: 11});
      const client = createSyncDb(harness.config);
      await client.start();

      const {id} = client.mutate({collection: "todos", data: {title: "x"}, operation: "create"});
      await flush();
      const entity = client.store.getEntity({collection: "todos", id});
      expect(entity?.pendingMutationId).toBeUndefined();
      expect(entity?.seq).toBe(11);
      expect(client.getSyncStatus().queuedCount).toBe(0);
      await client.stop();
    });

    it("updates merge into the existing entity data", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      client.store.upsertEntity({
        collection: "todos",
        data: {completed: false, title: "old"},
        id: "t1",
        seq: 3,
      });

      const {mutationId} = client.mutate({
        collection: "todos",
        data: {title: "new"},
        id: "t1",
        operation: "update",
      });
      expect(client.store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({
        completed: false,
        title: "new",
      });
      // baseVersion carries the entity's last known seq.
      expect(client.outbox.getMutation({mutationId})?.baseVersion).toBe(3);
      await client.stop();
    });

    it("deletes tombstone locally while keeping the last data", async () => {
      const harness = makeHarness();
      harness.transport.setDefaultResponder(() => {
        throw new Error("offline");
      });
      const client = createSyncDb(harness.config);
      await client.start();
      client.store.upsertEntity({collection: "todos", data: {title: "bye"}, id: "t1", seq: 2});

      const {mutationId} = client.mutate({collection: "todos", id: "t1", operation: "delete"});
      const tombstone = client.store.getEntity({collection: "todos", id: "t1"});
      expect(tombstone?.deleted).toBe(true);
      expect(tombstone?.data).toEqual({title: "bye"});
      expect(tombstone?.pendingMutationId).toBe(mutationId);
      // Deleted entities disappear from default list reads.
      expect(client.store.listEntities({collection: "todos"})).toEqual([]);
      await client.stop();
    });
  });

  it("applies transport deltas to the local store", async () => {
    const harness = makeHarness();
    const client = createSyncDb(harness.config);
    await client.start();

    harness.transport.deliverDelta(makeDelta());
    expect(client.store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({
      title: "from server",
    });
    expect(client.getSyncStatus().streams["todos|owner:u1"]).toBe(1);
    await client.stop();
  });

  describe("reconcile triggers", () => {
    it("reconciles and replays when the transport (re)connects", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      await flush();
      const baseline = harness.http.state.fetchCount;
      expect(baseline).toBeGreaterThanOrEqual(1);

      harness.transport.setConnected(false);
      harness.transport.setConnected(true);
      await flush();
      expect(harness.http.state.fetchCount).toBe(baseline + 1);
      await client.stop();
    });

    it("rate-limits seq-jump reconciles per stream", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      await flush();
      const baseline = harness.http.state.fetchCount;

      // First jump (seq 10 with cursor 0) triggers a reconcile.
      harness.transport.deliverDelta(makeDelta({id: "a", seq: 10}));
      await flush();
      expect(harness.http.state.fetchCount).toBe(baseline + 1);

      // A second jump on the same stream inside the window is suppressed.
      harness.transport.deliverDelta(makeDelta({id: "b", seq: 20}));
      await flush();
      expect(harness.http.state.fetchCount).toBe(baseline + 1);

      // A jump on a different stream is rate-limited independently.
      harness.transport.deliverDelta(makeDelta({id: "c", seq: 10, stream: "todos|owner:other"}));
      await flush();
      expect(harness.http.state.fetchCount).toBe(baseline + 2);

      // After the per-stream window elapses the same stream may reconcile again.
      harness.clock.value += 30_000;
      harness.transport.deliverDelta(makeDelta({id: "d", seq: 40}));
      await flush();
      expect(harness.http.state.fetchCount).toBe(baseline + 3);
      await client.stop();
    });

    it("non-jump deltas never trigger a reconcile", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      await flush();
      const baseline = harness.http.state.fetchCount;
      harness.transport.deliverDelta(makeDelta({seq: 1}));
      await flush();
      expect(harness.http.state.fetchCount).toBe(baseline);
      await client.stop();
    });

    it("runs the periodic reconcile timer and stops it on stop()", async () => {
      const harness = makeHarness({reconcileIntervalMs: 20});
      const client = createSyncDb(harness.config);
      await client.start();
      await flush();
      const baseline = harness.http.state.fetchCount;
      await new Promise((resolve) => setTimeout(resolve, 70));
      const afterTimer = harness.http.state.fetchCount;
      expect(afterTimer).toBeGreaterThan(baseline);

      await client.stop();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(harness.http.state.fetchCount).toBe(afterTimer);
    });

    it("reconcile() is a no-op without an http channel", async () => {
      const harness = makeHarness({httpChannel: undefined});
      const client = createSyncDb({...harness.config, httpChannel: undefined});
      await client.start();
      await expect(client.reconcile()).resolves.toBeUndefined();
      await client.stop();
    });
  });

  describe("wipe-on-user-change", () => {
    it("persists data across restarts for the same user", async () => {
      const name = uniqueName();
      const harness = makeHarness({name});
      const client = createSyncDb(harness.config);
      await client.start();
      client.mutate({collection: "todos", data: {title: "persisted"}, operation: "create"});
      await flush();
      await client.stop();

      const second = makeHarness({name});
      const reopened = createSyncDb(second.config);
      await reopened.start();
      expect(reopened.store.listEntities({collection: "todos"})).toHaveLength(1);
      expect(reopened.store.getLastUserId()).toBe("u1");
      await reopened.stop();
    });

    it("wipes entities, outbox, cursors, and conflicts when the user changes", async () => {
      const name = uniqueName();
      const harness = makeHarness({name});
      harness.transport.setDefaultResponder(() => {
        throw new Error("offline");
      });
      const client = createSyncDb(harness.config);
      await client.start();
      client.mutate({collection: "todos", data: {title: "secret"}, operation: "create"});
      harness.transport.deliverDelta(makeDelta({id: "t9", seq: 2}));
      await flush();
      await client.stop();

      const second = makeHarness({name});
      second.auth.setUserId("u2");
      const nextClient = createSyncDb(second.config);
      await nextClient.start();
      expect(nextClient.store.listEntities({collection: "todos", includeDeleted: true})).toEqual(
        []
      );
      expect(nextClient.outbox.listQueued({userId: "u1"})).toEqual([]);
      expect(nextClient.getSyncStatus().streams).toEqual({});
      expect(nextClient.store.getLastUserId()).toBe("u2");
      await nextClient.stop();
    });

    it("wipes and replays on an in-session auth user switch", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      client.store.upsertEntity({collection: "todos", data: {title: "mine"}, id: "t1", seq: 1});

      harness.auth.setUserId("u2");
      harness.auth.emitAuthChange();
      await flush();
      expect(client.store.listEntities({collection: "todos"})).toEqual([]);
      expect(client.store.getLastUserId()).toBe("u2");
      await client.stop();
    });

    it("an auth change for the same user replays queued mutations", async () => {
      const harness = makeHarness();
      harness.transport.setDefaultResponder(() => {
        throw new Error("offline");
      });
      const client = createSyncDb(harness.config);
      await client.start();
      const {id} = client.mutate({collection: "todos", data: {title: "x"}, operation: "create"});
      await flush();
      expect(client.getSyncStatus().queuedCount).toBe(1);

      harness.transport.setDefaultResponder();
      harness.auth.emitAuthChange();
      await flush();
      expect(client.getSyncStatus().queuedCount).toBe(0);
      expect(client.store.getEntity({collection: "todos", id})?.pendingMutationId).toBeUndefined();
      await client.stop();
    });

    it("a signed-out auth change clears the current user without wiping", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      client.store.upsertEntity({collection: "todos", data: {title: "kept"}, id: "t1"});

      harness.auth.setUserId(null);
      harness.auth.emitAuthChange();
      await flush();
      expect(client.store.listEntities({collection: "todos"})).toHaveLength(1);
      expect(() => client.mutate({collection: "todos", operation: "create"})).toThrow(
        "requires start()"
      );
      await client.stop();
    });
  });

  describe("conflicts", () => {
    it("records conflicts from nacks and resolves them via the client", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      client.store.upsertEntity({collection: "todos", data: {title: "old"}, id: "t1", seq: 2});
      harness.transport.respondWithNack({
        code: "conflict",
        serverDoc: {title: "server wins"},
        serverSeq: 7,
      });

      const {mutationId} = client.mutate({
        collection: "todos",
        data: {title: "mine"},
        id: "t1",
        operation: "update",
      });
      await flush();
      expect(client.getSyncStatus().conflictCount).toBe(1);
      expect(getConflict({mutationId, store: client.store})?.serverSeq).toBe(7);

      client.resolveConflict({mutationId, strategy: "useServer"});
      expect(client.getSyncStatus().conflictCount).toBe(0);
      expect(client.store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({
        title: "server wins",
      });
      await client.stop();
    });
  });

  it("falls back to the HTTP channel for mutations while disconnected", async () => {
    const harness = makeHarness();
    const offlineTransport: FakeTransport = {
      ...harness.transport,
      connect: async () => {
        throw new Error("no network");
      },
    };
    let httpMutations = 0;
    const http: HttpChannel = {
      fetchSnapshotPage: harness.http.channel.fetchSnapshotPage,
      sendMutation: async (request) => {
        httpMutations += 1;
        return {ack: {id: request.id ?? "", mutationId: request.mutationId, seq: 5}, type: "ack"};
      },
    };
    const client = createSyncDb({
      ...harness.config,
      httpChannel: http,
      transport: offlineTransport,
    });
    await client.start();

    const {id} = client.mutate({collection: "todos", data: {title: "x"}, operation: "create"});
    await flush();
    expect(httpMutations).toBe(1);
    expect(client.store.getEntity({collection: "todos", id})?.seq).toBe(5);
    await client.stop();
  });

  it("aggregates sync status", async () => {
    const harness = makeHarness();
    harness.transport.setDefaultResponder(() => {
      throw new Error("offline");
    });
    const client = createSyncDb(harness.config);
    await client.start();
    expect(client.getSyncStatus().isOnline).toBe(true);

    client.mutate({collection: "todos", data: {title: "a"}, operation: "create"});
    await flush();
    const status = client.getSyncStatus();
    expect(status.queuedCount).toBe(1);
    expect(status.conflictCount).toBe(0);
    expect(status.isSyncing).toBe(false);

    harness.transport.setConnected(false);
    expect(client.getSyncStatus().isOnline).toBe(false);
    await client.stop();
  });

  it("stop() disconnects and removes listeners", async () => {
    const harness = makeHarness();
    const client = createSyncDb(harness.config);
    await client.start();
    await client.stop();
    expect(client.getSyncStatus().isOnline).toBe(false);

    // Deltas delivered after stop are ignored (listener removed).
    harness.transport.deliverDelta(makeDelta());
    expect(client.store.getEntity({collection: "todos", id: "t1"})).toBeUndefined();
    // Auth changes after stop are ignored too.
    harness.auth.emitAuthChange();
    await flush();
  });
});
