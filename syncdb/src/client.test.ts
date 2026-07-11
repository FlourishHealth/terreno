import {describe, expect, it} from "bun:test";

import {createSyncDb, type SyncDbConfig} from "./client";
import {getConflict} from "./mutations/conflicts";
import {memoryPersisterFactory} from "./persisters/memoryPersister";
import {createFakeTransport, type FakeTransport} from "./sync/fakeTransport";
import {AuthRequiredError, type HttpChannel} from "./sync/httpChannel";
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
      fetchKeyMaterial: async () => {
        throw new Error("key material not expected in this test");
      },
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
      blockedEntities: 0,
      conflictCount: 0,
      draining: false,
      failedCount: 0,
      isOnline: false,
      isSyncing: false,
      queuedCount: 0,
      sentThisDrain: 0,
      streams: {},
      totalThisDrain: 0,
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

      // The failed send armed a jittered transport-failure backoff (A3,
      // unlimited retries) — advance past its cap so the retry is eligible
      // again before the auth-change replay trigger runs.
      harness.clock.value += 30_000;
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

  describe("simulated offline (goOffline/goOnline)", () => {
    it("mutate while offline applies locally, queues, and reports offline", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      let statusChanges = 0;
      const unsubscribe = client.onStatusChange(() => {
        statusChanges += 1;
      });

      client.goOffline();
      expect(client.getSyncStatus().isOnline).toBe(false);
      expect(statusChanges).toBe(1);

      const {id, mutationId} = client.mutate({
        collection: "todos",
        data: {title: "offline milk run"},
        operation: "create",
      });
      await flush();
      const entity = client.store.getEntity({collection: "todos", id});
      expect(entity?.data).toEqual({title: "offline milk run"});
      expect(entity?.pendingMutationId).toBe(mutationId);
      expect(client.outbox.getMutation({mutationId})?.status).toBe("queued");
      expect(client.getSyncStatus().queuedCount).toBe(1);
      // Nothing is sent while offline — not even via the HTTP fallback.
      expect(harness.transport.sentMutations).toHaveLength(0);

      unsubscribe();
      await client.stop();
    });

    it("goOnline reconnects and replays the queued mutation", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();

      client.goOffline();
      const {id} = client.mutate({
        collection: "todos",
        data: {title: "queued"},
        operation: "create",
      });
      await flush();
      expect(client.getSyncStatus().queuedCount).toBe(1);

      await client.goOnline();
      await flush();
      expect(client.getSyncStatus().isOnline).toBe(true);
      expect(client.getSyncStatus().queuedCount).toBe(0);
      expect(harness.transport.sentMutations).toHaveLength(1);
      expect(client.store.getEntity({collection: "todos", id})?.pendingMutationId).toBeUndefined();
      await client.stop();
    });

    it("goOffline/goOnline are idempotent and record debug transitions", async () => {
      const harness = makeHarness({debug: true});
      const client = createSyncDb(harness.config);
      await client.start();

      // A no-op goOnline while already online must not double-connect.
      await client.goOnline();
      expect(client.getSyncStatus().isOnline).toBe(true);

      client.goOffline();
      client.goOffline();
      expect(client.getSyncStatus().isOnline).toBe(false);
      await client.goOnline();
      await flush();
      expect(client.getSyncStatus().isOnline).toBe(true);

      const types = client.debug?.getEvents().map((event) => event.type) ?? [];
      expect(types).toContain("disconnect");
      expect(types.filter((type) => type === "connect").length).toBeGreaterThanOrEqual(2);
      await client.stop();
    });

    it("the periodic timer pauses while offline and resumes on goOnline", async () => {
      const harness = makeHarness({reconcileIntervalMs: 20});
      const client = createSyncDb(harness.config);
      await client.start();
      await flush();

      client.goOffline();
      const baseline = harness.http.state.fetchCount;
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(harness.http.state.fetchCount).toBe(baseline);

      await client.goOnline();
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(harness.http.state.fetchCount).toBeGreaterThan(baseline);
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

  describe("batched drain (B3/B4/B5)", () => {
    it("sends multiple queued mutations as a single batch via the socket transport", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      harness.transport.setConnected(true);

      client.mutate({collection: "todos", data: {title: "a"}, operation: "create"});
      client.mutate({collection: "todos", data: {title: "b"}, operation: "create"});
      client.mutate({collection: "todos", data: {title: "c"}, operation: "create"});
      await flush();

      expect(harness.transport.sentBatches.length).toBeGreaterThanOrEqual(1);
      expect(harness.transport.sentBatches.flat()).toHaveLength(3);
      expect(client.getSyncStatus().queuedCount).toBe(0);
      await client.stop();
    });

    it("re-probes batch support on reconnect after a batch-unsupported determination", async () => {
      const harness = makeHarness();
      harness.transport.setBatchResponder(() => ({type: "unsupported"}));
      const client = createSyncDb(harness.config);
      await client.start();
      harness.transport.setConnected(true);

      client.mutate({collection: "todos", data: {title: "a"}, operation: "create"});
      client.mutate({collection: "todos", data: {title: "b"}, operation: "create"});
      await flush();
      expect(client.getSyncStatus().queuedCount).toBe(0);
      expect(harness.transport.sentMutations).toHaveLength(2);

      harness.transport.setBatchResponder();
      // A reconnect re-probes batch support.
      harness.transport.setConnected(false);
      await flush();
      harness.transport.setConnected(true);
      await flush();
      client.mutate({collection: "todos", data: {title: "c"}, operation: "create"});
      client.mutate({collection: "todos", data: {title: "d"}, operation: "create"});
      await flush();
      expect(harness.transport.sentBatches.length).toBeGreaterThanOrEqual(1);
      await client.stop();
    });

    it("retryFailed re-enables an entity's successors after a validation failure", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      harness.transport.setConnected(true);

      harness.transport.respondWithNack({code: "validation", message: "bad data"});
      const {id} = client.mutate({collection: "todos", data: {title: "bad"}, operation: "create"});
      await flush();
      expect(client.getSyncStatus().failedCount).toBe(1);

      client.mutate({collection: "todos", data: {title: "v2"}, id, operation: "update"});
      await flush();
      // The successor is blocked and surfaced, not sent.
      expect(client.getSyncStatus().blockedEntities).toBe(1);
      expect(client.getSyncStatus().queuedCount).toBe(1);

      client.retryFailed({entityId: id});
      await flush();
      expect(client.getSyncStatus().blockedEntities).toBe(0);
      expect(client.getSyncStatus().queuedCount).toBe(0);
      await client.stop();
    });

    it("getSyncStatus reports draining and drain progress while a replay is in flight", async () => {
      const harness = makeHarness();
      let release: (() => void) | undefined;
      harness.transport.respondWith(async (request) => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return {ack: {id: request.id ?? "", mutationId: request.mutationId, seq: 1}, type: "ack"};
      });
      const client = createSyncDb(harness.config);
      await client.start();
      harness.transport.setConnected(true);
      // Let the startup no-op replay (empty queue) settle before enqueuing,
      // so the drain this test observes is the one triggered by mutate().
      await flush();

      client.mutate({collection: "todos", data: {title: "a"}, operation: "create"});
      await flush();
      const midDrainStatus = client.getSyncStatus();
      expect(midDrainStatus.draining).toBe(true);
      expect(midDrainStatus.totalThisDrain).toBeGreaterThanOrEqual(1);

      release?.();
      await flush();
      expect(client.getSyncStatus().draining).toBe(false);
      await client.stop();
    });

    it("respects a configured batchSize", async () => {
      const harness = makeHarness({batchSize: 2});
      const client = createSyncDb(harness.config);
      await client.start();
      harness.transport.setConnected(true);
      // Let the startup no-op replay (empty queue) settle first.
      await flush();

      for (let i = 0; i < 5; i++) {
        client.mutate({collection: "todos", data: {title: `t${i}`}, operation: "create"});
      }
      await flush();
      await flush();
      // 5 mutations at batchSize 2: two full batches of 2, then a lone
      // eligible mutation reuses the single-send path (not a batch of one).
      expect(harness.transport.sentBatches.map((b) => b.length)).toEqual([2, 2]);
      expect(harness.transport.sentMutations).toHaveLength(1);
      expect(client.getSyncStatus().queuedCount).toBe(0);
      await client.stop();
    });

    it("haltQueueOnConflict config plumbs through to the coordinator: a conflict halts the whole batch", async () => {
      const harness = makeHarness({haltQueueOnConflict: true});
      const client = createSyncDb(harness.config);
      await client.start();
      harness.transport.setConnected(true);
      // Let the startup no-op replay (empty queue) settle first.
      await flush();
      client.store.upsertEntity({collection: "todos", data: {title: "old"}, id: "t1", seq: 2});
      client.store.upsertEntity({collection: "todos", data: {title: "other"}, id: "t2"});

      // Enqueue both mutations via the outbox directly (bypassing mutate()'s
      // own fire-and-forget replay trigger, which would otherwise start
      // draining synchronously — up to its first real await — before the
      // second mutation exists, guaranteeing they land in separate chunks)
      // so a single replayOutbox() call sees both together deterministically.
      const mutationId = "halt-conflict-t1";
      client.outbox.enqueue({
        args: {title: "mine"},
        baseVersion: 2,
        collection: "todos",
        entityId: "t1",
        mutationId,
        operation: "update",
        userId: "u1",
      });
      client.outbox.enqueue({
        args: {title: "other"},
        collection: "todos",
        entityId: "t2",
        mutationId: "halt-conflict-t2",
        operation: "update",
        userId: "u1",
      });

      // Realistic server behavior (B2 stop-on-first-non-ack): t1 is first and
      // conflicts, so "other" never gets attempted — truncated response.
      harness.transport.setBatchResponder(() => ({
        results: [{nack: {code: "conflict", mutationId, serverSeq: 7}, type: "nack"}],
        type: "results",
      }));
      await client.replayOutbox();

      expect(client.getSyncStatus().conflictCount).toBe(1);
      // The second (distinct-entity) mutation never got a result and never
      // sent again this pass — haltQueueOnConflict stopped the whole drain.
      expect(client.getSyncStatus().queuedCount).toBe(1);
      expect(client.outbox.getMutation({mutationId})?.status).toBe("conflicted");
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
      fetchKeyMaterial: harness.http.channel.fetchKeyMaterial,
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

  describe("debug log", () => {
    it("is undefined by default and present when enabled", async () => {
      const off = createSyncDb(makeHarness().config);
      expect(off.debug).toBeUndefined();

      const on = createSyncDb(makeHarness({debug: true}).config);
      expect(on.debug).toBeDefined();
    });

    it("records local mutations, inbound deltas, sends and acks", async () => {
      const harness = makeHarness({debug: true});
      const client = createSyncDb(harness.config);
      await client.start();

      client.mutate({collection: "todos", data: {title: "a"}, operation: "create"});
      await flush();
      harness.transport.deliverDelta(makeDelta({id: "t9", seq: 1}));

      const types = client.debug?.getEvents().map((e) => e.type) ?? [];
      expect(types).toContain("mutate");
      expect(types).toContain("send");
      expect(types).toContain("ack");
      expect(types).toContain("delta");

      const mutateEvent = client.debug?.getEvents().find((e) => e.type === "mutate");
      expect(mutateEvent?.collection).toBe("todos");
      expect(mutateEvent?.operation).toBe("create");
      await client.stop();
    });

    it("records conflict nacks", async () => {
      const harness = makeHarness({debug: true});
      harness.transport.setDefaultResponder((request) => ({
        nack: {
          code: "conflict",
          mutationId: request.mutationId,
          serverDoc: {title: "server wins"},
          serverSeq: 7,
        },
        type: "nack",
      }));
      const client = createSyncDb(harness.config);
      await client.start();

      client.mutate({collection: "todos", data: {title: "mine"}, operation: "create"});
      await flush();

      const conflict = client.debug?.getEvents().find((e) => e.type === "conflict");
      expect(conflict?.ok).toBe(false);
      expect(conflict?.detail?.serverSeq).toBe(7);
      await client.stop();
    });

    it("skips the debug-only listQueued scan in replayOutbox() when debug is disabled (A3)", async () => {
      const countListQueuedCalls = async (debug: boolean): Promise<number> => {
        const harness = makeHarness({debug});
        const client = createSyncDb(harness.config);
        await client.start();
        await flush();
        const originalListQueued = client.outbox.listQueued;
        let calls = 0;
        // biome-ignore lint/suspicious/noExplicitAny: test-only spy shim
        (client.outbox as any).listQueued = (...args: any[]) => {
          calls += 1;
          return originalListQueued(...(args as [{collection?: string; userId: string}]));
        };
        await client.replayOutbox();
        await client.stop();
        return calls;
      };

      const withoutDebug = await countListQueuedCalls(false);
      const withDebug = await countListQueuedCalls(true);
      // The debug label adds exactly one extra listQueued scan (the drain
      // itself still calls listQueued to find work) — proving the debug-only
      // scan is conditional, not unconditional.
      expect(withDebug).toBe(withoutDebug + 1);
    });
  });

  describe("startup recovery (A1)", () => {
    it("recovers a stranded inFlight row on start(): it replays and the entity receives deltas again", async () => {
      const name = uniqueName();
      const harness = makeHarness({name});
      // Hold every send indefinitely so the mutation is still inFlight when
      // stop() is called (simulating a crash mid-send, not a clean stop).
      harness.transport.respondWith(() => new Promise(() => {}));
      const client = createSyncDb(harness.config);
      await client.start();
      const {id, mutationId} = client.mutate({
        collection: "todos",
        data: {title: "stranded"},
        operation: "create",
      });
      await flush();
      expect(client.outbox.getMutation({mutationId})?.status).toBe("inFlight");
      // stop() itself never repairs outbox state (only start() does) — a
      // clean stop() here still leaves the row inFlight in persisted content,
      // standing in for a hard crash that never ran a graceful shutdown.
      await client.stop();

      const second = makeHarness({name});
      const reopened = createSyncDb(second.config);
      await reopened.start();
      await flush();
      // Recovered to queued and replayed against the fresh (auto-acking)
      // transport: the row acks and — per A5 — is pruned immediately, so its
      // resolution shows up as a successful send, not a lingering outbox row.
      expect(reopened.outbox.getMutation({mutationId})).toBeUndefined();
      expect(second.transport.sentMutations.map((m) => m.mutationId)).toContain(mutationId);
      expect(
        reopened.store.getEntity({collection: "todos", id})?.pendingMutationId
      ).toBeUndefined();
      // The entity's pendingMutationId was released — a subsequent delta applies.
      second.transport.deliverDelta({
        collection: "todos",
        data: {title: "from server"},
        id,
        method: "update",
        seq: 99,
        stream: "todos|owner:u1",
      });
      expect(reopened.store.getEntity({collection: "todos", id})?.data).toEqual({
        title: "from server",
      });
      await reopened.stop();
    });

    it("clears a stale pendingMutationId for an acked-with-pending row on start()", async () => {
      const name = uniqueName();
      const harness = makeHarness({name});
      const client = createSyncDb(harness.config);
      await client.start();
      client.store.upsertEntity({
        collection: "todos",
        data: {title: "x"},
        id: "t1",
        pendingMutationId: "m1",
      });
      client.outbox.enqueue({
        args: {title: "x"},
        collection: "todos",
        entityId: "t1",
        mutationId: "m1",
        operation: "create",
        userId: "u1",
      });
      client.outbox.markInFlight({mutationId: "m1"});
      client.outbox.markAcked({mutationId: "m1"});
      // Simulate a crash between markAcked and releaseEntity.
      await flush();
      await client.stop();

      const second = makeHarness({name});
      const reopened = createSyncDb(second.config);
      await reopened.start();
      expect(
        reopened.store.getEntity({collection: "todos", id: "t1"})?.pendingMutationId
      ).toBeUndefined();
      await reopened.stop();
    });

    it("writes a missing conflict row for a conflicted mutation on start()", async () => {
      const name = uniqueName();
      const harness = makeHarness({name});
      const client = createSyncDb(harness.config);
      await client.start();
      client.store.upsertEntity({
        collection: "todos",
        data: {title: "local"},
        id: "t1",
        pendingMutationId: "m1",
      });
      client.outbox.enqueue({
        args: {title: "local"},
        collection: "todos",
        entityId: "t1",
        mutationId: "m1",
        operation: "create",
        userId: "u1",
      });
      client.outbox.markInFlight({mutationId: "m1"});
      client.outbox.markConflicted({mutationId: "m1"});
      // Simulate a crash between markConflicted and writeConflict: no row yet.
      expect(getConflict({mutationId: "m1", store: client.store})).toBeUndefined();
      await flush();
      await client.stop();

      const second = makeHarness({name});
      const reopened = createSyncDb(second.config);
      await reopened.start();
      const conflict = getConflict({mutationId: "m1", store: reopened.store});
      expect(conflict?.entityId).toBe("t1");
      expect(conflict?.serverSeq).toBe(0);
      await reopened.stop();
    });
  });

  describe("outbox hygiene (A5)", () => {
    it("prunes acked rows after a successful drain pass, driven end-to-end through mutate()", async () => {
      const harness = makeHarness();
      harness.transport.respondWithAck({seq: 1});
      const client = createSyncDb(harness.config);
      await client.start();

      const {mutationId} = client.mutate({
        collection: "todos",
        data: {title: "x"},
        operation: "create",
      });
      await flush();
      // The mutation acked and was pruned in the same drain pass — no lingering row.
      expect(client.outbox.getMutation({mutationId})).toBeUndefined();
      expect(client.getSyncStatus().queuedCount).toBe(0);
      await client.stop();
    });

    it("keeps failed rows visible in failedCount until pruned past the retention window", async () => {
      const harness = makeHarness();
      harness.transport.setDefaultResponder((request) => ({
        nack: {code: "validation", mutationId: request.mutationId},
        type: "nack",
      }));
      const client = createSyncDb(harness.config);
      await client.start();
      client.mutate({collection: "todos", data: {title: "bad"}, operation: "create"});
      await flush();
      expect(client.getSyncStatus().failedCount).toBe(1);
      await client.stop();
    });
  });

  describe("auth-pause pipeline (A4)", () => {
    /** Force sendMutation through the HTTP channel (offline transport) so AuthRequiredError surfaces. */
    const makeAuthPauseHarness = (
      overrides: Partial<SyncDbConfig> = {}
    ): Harness & {offlineTransport: FakeTransport} => {
      const harness = makeHarness(overrides);
      const offlineTransport: FakeTransport = {
        ...harness.transport,
        connect: async () => {
          throw new Error("no network");
        },
      };
      harness.config.transport = offlineTransport;
      return {...harness, offlineTransport};
    };

    it("AuthRequiredError from the HTTP channel pauses sync, leaves the outbox untouched, burns zero budget, and fires onAuthRequired once", async () => {
      const harness = makeAuthPauseHarness();
      let authRequiredCount = 0;
      harness.config.onAuthRequired = () => {
        authRequiredCount += 1;
      };
      harness.http.channel.sendMutation = async () => {
        throw new AuthRequiredError();
      };
      const client = createSyncDb(harness.config);
      await client.start();

      const {mutationId} = client.mutate({
        collection: "todos",
        data: {title: "x"},
        operation: "create",
      });
      await flush();

      expect(client.getSyncStatus().paused).toBe("auth");
      const mutation = client.outbox.getMutation({mutationId});
      expect(mutation?.status).toBe("queued");
      expect(mutation?.errorNackCount).toBe(0);
      expect(authRequiredCount).toBe(1);

      // A second replay trigger while still paused must not re-fire the hook.
      await client.replayOutbox();
      expect(authRequiredCount).toBe(1);
      await client.stop();
    });

    it("same-user re-auth clears the pause and drains the queue fully, entity converges", async () => {
      const harness = makeAuthPauseHarness();
      harness.http.channel.sendMutation = async () => {
        throw new AuthRequiredError();
      };
      const client = createSyncDb(harness.config);
      await client.start();
      const {id, mutationId} = client.mutate({
        collection: "todos",
        data: {title: "x"},
        operation: "create",
      });
      await flush();
      expect(client.getSyncStatus().paused).toBe("auth");

      // Re-authenticate as the SAME user with a channel that now works.
      harness.http.channel.sendMutation = async (request) => ({
        ack: {id: request.id ?? "", mutationId: request.mutationId, seq: 1},
        type: "ack",
      });
      harness.auth.emitAuthChange();
      await flush();

      expect(client.getSyncStatus().paused).toBeUndefined();
      expect(client.getSyncStatus().queuedCount).toBe(0);
      expect(client.outbox.getMutation({mutationId})).toBeUndefined();
      expect(client.store.getEntity({collection: "todos", id})?.pendingMutationId).toBeUndefined();
      await client.stop();
    });

    it("logout (userId -> undefined) retains local data; a later same-user login drains the queue", async () => {
      const harness = makeAuthPauseHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      client.store.upsertEntity({collection: "todos", data: {title: "kept"}, id: "t1"});

      harness.auth.setUserId(null);
      harness.auth.emitAuthChange();
      await flush();
      expect(client.store.listEntities({collection: "todos"})).toHaveLength(1);
      expect(client.getSyncStatus().paused).toBe("auth");

      // Same user comes back — resumes fully, no wipe occurred.
      harness.auth.setUserId("u1");
      harness.auth.emitAuthChange();
      await flush();
      expect(client.getSyncStatus().paused).toBeUndefined();
      expect(client.store.listEntities({collection: "todos"})).toHaveLength(1);
      await client.stop();
    });

    it("a different-user login still wipes local data (regression)", async () => {
      const name = uniqueName();
      const harness = makeAuthPauseHarness({name});
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

    it("no reconcile/snapshot requests are issued while paused", async () => {
      const harness = makeAuthPauseHarness();
      harness.http.channel.sendMutation = async () => {
        throw new AuthRequiredError();
      };
      const client = createSyncDb(harness.config);
      await client.start();
      client.mutate({collection: "todos", data: {title: "x"}, operation: "create"});
      await flush();
      expect(client.getSyncStatus().paused).toBe("auth");

      const baseline = harness.http.state.fetchCount;
      await client.reconcile();
      expect(harness.http.state.fetchCount).toBe(baseline);
      await client.stop();
    });

    it("betterAuthAdapter's refresh() gets one silent attempt per pause episode, and a successful refresh resumes replay immediately", async () => {
      const harness = makeAuthPauseHarness();
      let refreshCalls = 0;
      let shouldSucceed = false;
      harness.config.authProvider = {
        ...harness.auth.provider,
        refresh: async () => {
          refreshCalls += 1;
          if (shouldSucceed) {
            // A real adapter's refresh() renews the underlying token in place;
            // simulate that by making the channel work again before reporting success.
            harness.http.channel.sendMutation = async (request) => ({
              ack: {id: request.id ?? "", mutationId: request.mutationId, seq: 1},
              type: "ack",
            });
          }
          return shouldSucceed;
        },
      };
      harness.http.channel.sendMutation = async () => {
        throw new AuthRequiredError();
      };
      const client = createSyncDb(harness.config);
      await client.start();
      const {mutationId} = client.mutate({
        collection: "todos",
        data: {title: "x"},
        operation: "create",
      });
      await flush();
      expect(refreshCalls).toBe(1);
      expect(client.getSyncStatus().paused).toBe("auth");

      // Further replay triggers within the SAME episode never re-attempt refresh.
      await client.replayOutbox();
      await client.replayOutbox();
      expect(refreshCalls).toBe(1);

      // The episode ends via same-user re-auth (not refresh) — the outbox is
      // still intact and unpaused replay drains it.
      harness.http.channel.sendMutation = async (request) => ({
        ack: {id: request.id ?? "", mutationId: request.mutationId, seq: 1},
        type: "ack",
      });
      harness.auth.emitAuthChange();
      await flush();
      expect(client.getSyncStatus().paused).toBeUndefined();
      expect(client.outbox.getMutation({mutationId})).toBeUndefined();

      // A FRESH pause episode (new failing mutation) gets its own refresh
      // attempt, and this time a successful refresh resumes replay immediately.
      shouldSucceed = true;
      harness.http.channel.sendMutation = async () => {
        throw new AuthRequiredError();
      };
      const {mutationId: secondMutationId} = client.mutate({
        collection: "todos",
        data: {title: "y"},
        operation: "create",
      });
      await flush();
      expect(refreshCalls).toBe(2);
      // The refresh succeeded, so the pause clears and replay retried with the
      // (now-working) channel rather than staying surfaced to the app.
      expect(client.getSyncStatus().paused).toBeUndefined();
      expect(client.outbox.getMutation({mutationId: secondMutationId})).toBeUndefined();
      await client.stop();
    });
  });

  describe("signOut() (A4)", () => {
    it("clears the current user without wiping when wipeOnSignOut is not set", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      client.store.upsertEntity({collection: "todos", data: {title: "kept"}, id: "t1"});

      await client.signOut();
      expect(client.store.listEntities({collection: "todos"})).toHaveLength(1);
      expect(() => client.mutate({collection: "todos", operation: "create"})).toThrow(
        "requires start()"
      );
    });

    it("wipes local data when wipeOnSignOut is configured", async () => {
      const harness = makeHarness({wipeOnSignOut: true});
      const client = createSyncDb(harness.config);
      await client.start();
      client.store.upsertEntity({collection: "todos", data: {title: "gone"}, id: "t1"});

      await client.signOut();
      expect(client.store.listEntities({collection: "todos", includeDeleted: true})).toEqual([]);
    });
  });
});
