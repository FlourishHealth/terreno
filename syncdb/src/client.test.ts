import "fake-indexeddb/auto";

import {describe, expect, it} from "bun:test";

import {createSyncDb, type SyncDbConfig} from "./client";
import {createLocalKeyProvider, DEFAULT_KEY_CACHE_DB_NAME} from "./crypto/keyProviders";
import {getConflict} from "./mutations/conflicts";
import {createDefaultPersisterFactory as createWebPersisterFactory} from "./persisters/defaultPersisterFactory.web";
import {memoryPersisterFactory} from "./persisters/memoryPersister";
import {idbGet} from "./storage/idb";
import {SYNC_SCHEMA_VERSION} from "./storage/schema";
import {CURSORS_TABLE} from "./storage/types";
import {createFakeTransport, type FakeTransport} from "./sync/fakeTransport";
import {AuthRequiredError, type HttpChannel} from "./sync/httpChannel";
import type {AuthProvider, SyncDelta, SyncSnapshotResponse, SyncStreamInfo} from "./types";

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

/** The single stream the default harness advertises via GET /sync/streams. */
const DEFAULT_STREAM = "todos|owner:u1";

interface FakeChannel {
  channel: HttpChannel;
  state: {
    fetchCount: number;
    streamsCount: number;
    /** Snapshot pages keyed by stream key. */
    pages: Record<string, SyncSnapshotResponse>;
    /** The membership set GET /sync/streams returns; mutate in a test to model join/leave. */
    streams: SyncStreamInfo[];
    /** When set, fetchStreams throws this instead of returning (401/transport tests). */
    streamsError?: Error;
  };
}

/** An empty snapshot page carrying the C1/C7 fields (no more data, no retention gap). */
const emptyPage = (stream: string, cursor = 0): SyncSnapshotResponse => ({
  cursor,
  entities: [],
  frontierSeq: cursor,
  hasMore: false,
  oldestRetainedSeq: 0,
  stream,
});

const makeChannel = (): FakeChannel => {
  const state: FakeChannel["state"] = {
    fetchCount: 0,
    pages: {},
    streams: [{collection: "todos", stream: DEFAULT_STREAM}],
    streamsCount: 0,
  };
  return {
    channel: {
      fetchKeyMaterial: async () => {
        throw new Error("key material not expected in this test");
      },
      fetchSnapshotPage: async ({stream}) => {
        state.fetchCount += 1;
        return state.pages[stream] ?? emptyPage(stream);
      },
      fetchStreams: async () => {
        state.streamsCount += 1;
        if (state.streamsError) {
          throw state.streamsError;
        }
        return state.streams;
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
      persistence: "durable",
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

  describe("stream discovery, join & leave (C2)", () => {
    it("join: a newly-returned stream is bootstrapped from 0 and recorded as known", async () => {
      const harness = makeHarness();
      const joined = "todos|tenant:org1";
      // Server advertises the default owner stream plus a new tenant stream, and serves a
      // one-entity page for the joined stream.
      harness.http.state.streams = [
        {collection: "todos", stream: DEFAULT_STREAM},
        {collection: "todos", stream: joined},
      ];
      harness.http.state.pages[joined] = {
        cursor: 4,
        entities: [{data: {title: "tenant doc"}, deleted: false, id: "tj", seq: 4}],
        frontierSeq: 4,
        hasMore: false,
        oldestRetainedSeq: 0,
        stream: joined,
      };
      const client = createSyncDb(harness.config);
      await client.start();
      await flush();

      expect(client.store.getKnownStreams().sort()).toEqual([DEFAULT_STREAM, joined].sort());
      expect(client.store.getEntity({collection: "todos", id: "tj"})?.data).toEqual({
        title: "tenant doc",
      });
      await client.stop();
    });

    it("leave (HTTP 200): a stream absent from the server set is purged locally", async () => {
      const harness = makeHarness();
      const leaving = "todos|tenant:org1";
      // First discovery advertises both streams so org1 becomes known and its entity lands.
      harness.http.state.streams = [
        {collection: "todos", stream: DEFAULT_STREAM},
        {collection: "todos", stream: leaving},
      ];
      harness.http.state.pages[leaving] = {
        cursor: 2,
        entities: [{data: {title: "org doc"}, deleted: false, id: "og", seq: 2}],
        frontierSeq: 2,
        hasMore: false,
        oldestRetainedSeq: 0,
        stream: leaving,
      };
      const client = createSyncDb(harness.config);
      await client.start();
      await flush();
      expect(client.store.getEntity({collection: "todos", id: "og"})?.data).toEqual({
        title: "org doc",
      });
      expect(client.store.getKnownStreams()).toContain(leaving);

      // Membership changes: org1 is gone. A successful (HTTP 200) discovery purges it.
      harness.http.state.streams = [{collection: "todos", stream: DEFAULT_STREAM}];
      await client.reconcile();
      await flush();

      expect(client.store.getEntity({collection: "todos", id: "og"})).toBeUndefined();
      expect(client.store.getKnownStreams()).not.toContain(leaving);
      await client.stop();
    });

    it("leave under 401 (INV-2): NO purge, auth-pause, local data intact", async () => {
      const harness = makeHarness();
      const stream = "todos|tenant:org1";
      harness.http.state.streams = [
        {collection: "todos", stream: DEFAULT_STREAM},
        {collection: "todos", stream},
      ];
      harness.http.state.pages[stream] = {
        cursor: 2,
        entities: [{data: {title: "org doc"}, deleted: false, id: "og", seq: 2}],
        frontierSeq: 2,
        hasMore: false,
        oldestRetainedSeq: 0,
        stream,
      };
      const client = createSyncDb(harness.config);
      await client.start();
      await flush();
      expect(client.store.getEntity({collection: "todos", id: "og"})).toBeDefined();

      // A 401 during discovery is NOT a membership change: pause, purge NOTHING.
      harness.http.state.streamsError = new AuthRequiredError();
      await client.reconcile();
      await flush();

      expect(client.getSyncStatus().paused).toBe("auth");
      expect(client.store.getEntity({collection: "todos", id: "og"})?.data).toEqual({
        title: "org doc",
      });
      expect(client.store.getKnownStreams()).toContain(stream);
      await client.stop();
    });

    it("transport error during discovery: NO purge, data intact (not a membership change)", async () => {
      const harness = makeHarness();
      const stream = "todos|tenant:org1";
      harness.http.state.streams = [
        {collection: "todos", stream: DEFAULT_STREAM},
        {collection: "todos", stream},
      ];
      harness.http.state.pages[stream] = {
        cursor: 1,
        entities: [{data: {x: 1}, deleted: false, id: "og", seq: 1}],
        frontierSeq: 1,
        hasMore: false,
        oldestRetainedSeq: 0,
        stream,
      };
      const client = createSyncDb(harness.config);
      await client.start();
      await flush();
      expect(client.store.getEntity({collection: "todos", id: "og"})).toBeDefined();

      harness.http.state.streamsError = new Error("network down");
      // reconcile rethrows a transport error; the client's warn() wrapper swallows it, but
      // either way no purge happens and the pause state is NOT auth.
      await client.reconcile().catch(() => {});
      await flush();

      expect(client.store.getEntity({collection: "todos", id: "og"})).toBeDefined();
      expect(client.store.getKnownStreams()).toContain(stream);
      expect(client.getSyncStatus().paused).toBeUndefined();
      await client.stop();
    });

    it("legacy migration: a snapshot:{collection} cursor is dropped and streams re-bootstrap", async () => {
      const harness = makeHarness();
      harness.http.state.pages[DEFAULT_STREAM] = {
        cursor: 3,
        entities: [{data: {title: "fresh"}, deleted: false, id: "f1", seq: 3}],
        frontierSeq: 3,
        hasMore: false,
        oldestRetainedSeq: 0,
        stream: DEFAULT_STREAM,
      };
      const client = createSyncDb(harness.config);
      // Seed a legacy snapshot cursor + a stale known-stream entry BEFORE start(), as a
      // deployed client would hold. (The store is shared with the client instance.)
      client.store.raw.setRow(CURSORS_TABLE, "snapshot:todos", {seq: 42, updatedAt: "old"});
      client.store.addKnownStream({collection: "todos", stream: "todos|owner:stale"});

      await client.start();
      await flush();

      // The legacy pseudo-cursor is gone...
      expect(client.store.raw.hasRow(CURSORS_TABLE, "snapshot:todos")).toBe(false);
      // ...and the streams were re-bootstrapped from the current membership set.
      expect(client.store.getEntity({collection: "todos", id: "f1"})?.data).toEqual({
        title: "fresh",
      });
      expect(client.store.getKnownStreams()).toContain(DEFAULT_STREAM);
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
      await flush();

      // Enqueue directly (bypassing mutate()'s own per-call replay trigger,
      // which would otherwise start draining synchronously — up to its first
      // real await — before the second/third mutation exist, since each
      // mutate() call's fire-and-forget replayOutbox() can independently
      // observe the queue as it existed at that instant instead of all three
      // landing in the same batch) so a single replayOutbox() call sees all
      // three together deterministically.
      client.outbox.enqueue({
        args: {title: "a"},
        collection: "todos",
        entityId: "e1",
        operation: "create",
        userId: "u1",
      });
      client.outbox.enqueue({
        args: {title: "b"},
        collection: "todos",
        entityId: "e2",
        operation: "create",
        userId: "u1",
      });
      client.outbox.enqueue({
        args: {title: "c"},
        collection: "todos",
        entityId: "e3",
        operation: "create",
        userId: "u1",
      });
      await client.replayOutbox();

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
      await flush();

      client.outbox.enqueue({
        args: {title: "a"},
        collection: "todos",
        entityId: "e1",
        operation: "create",
        userId: "u1",
      });
      client.outbox.enqueue({
        args: {title: "b"},
        collection: "todos",
        entityId: "e2",
        operation: "create",
        userId: "u1",
      });
      await client.replayOutbox();
      expect(client.getSyncStatus().queuedCount).toBe(0);
      expect(harness.transport.sentMutations).toHaveLength(2);

      harness.transport.setBatchResponder();
      // A reconnect re-probes batch support.
      harness.transport.setConnected(false);
      await flush();
      harness.transport.setConnected(true);
      await flush();
      client.outbox.enqueue({
        args: {title: "c"},
        collection: "todos",
        entityId: "e3",
        operation: "create",
        userId: "u1",
      });
      client.outbox.enqueue({
        args: {title: "d"},
        collection: "todos",
        entityId: "e4",
        operation: "create",
        userId: "u1",
      });
      await client.replayOutbox();
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
      fetchStreams: harness.http.channel.fetchStreams,
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

  describe("socket session re-validation sweep mapping into auth-pause (D1)", () => {
    it("sync:auth-expired disconnect pauses sync with the outbox intact and zero budget consumed", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      harness.transport.setConnected(true);
      await flush();

      harness.transport.disconnectWithAuthExpired();
      await flush();
      expect(client.getSyncStatus().paused).toBe("auth");
      expect(client.getSyncStatus().isOnline).toBe(false);

      // A mutation enqueued WHILE paused must stay queued untouched — replay
      // stands down entirely until the pause clears (INV-2).
      const {mutationId} = client.mutate({
        collection: "todos",
        data: {title: "x"},
        operation: "create",
      });
      await flush();
      const mutation = client.outbox.getMutation({mutationId});
      expect(mutation?.status).toBe("queued");
      expect(mutation?.errorNackCount).toBe(0);
      expect(mutation?.attemptCount).toBe(0);
      await client.stop();
    });

    it("a plain disconnect (no auth-expired tag) does NOT enter the auth-pause state", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      harness.transport.setConnected(true);
      await flush();

      harness.transport.setConnected(false);
      await flush();

      expect(client.getSyncStatus().paused).toBeUndefined();
      expect(client.getSyncStatus().isOnline).toBe(false);
      await client.stop();
    });

    it("same-user re-auth after a sync:auth-expired pause resumes replay with the outbox intact", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      harness.transport.setConnected(true);
      await flush();

      harness.transport.disconnectWithAuthExpired();
      await flush();
      expect(client.getSyncStatus().paused).toBe("auth");

      // Enqueued while paused — stays queued (INV-2) until the pause clears.
      const {id, mutationId} = client.mutate({
        collection: "todos",
        data: {title: "x"},
        operation: "create",
      });
      await flush();
      expect(client.outbox.getMutation({mutationId})?.status).toBe("queued");

      // Same-user re-auth clears the pause; the transport reconnects and drains
      // the queue fully (the fake transport auto-acks by default).
      harness.auth.emitAuthChange();
      harness.transport.setConnected(true);
      await flush();

      expect(client.getSyncStatus().paused).toBeUndefined();
      expect(client.outbox.getMutation({mutationId})).toBeUndefined();
      expect(client.store.getEntity({collection: "todos", id})?.pendingMutationId).toBeUndefined();
      await client.stop();
    });

    it("no reconcile/replay is issued while paused from a sync:auth-expired disconnect", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      harness.transport.setConnected(true);
      await flush();

      harness.transport.disconnectWithAuthExpired();
      await flush();
      expect(client.getSyncStatus().paused).toBe("auth");

      const baseline = harness.http.state.fetchCount;
      await client.reconcile();
      expect(harness.http.state.fetchCount).toBe(baseline);
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

  describe("lifecycle serialization (E1)", () => {
    it("a rapid stop()-then-start() for a new user leaves the new user's persistence working", async () => {
      const name = uniqueName();
      const harness = makeHarness({name});
      const client = createSyncDb(harness.config);
      await client.start();
      client.mutate({collection: "todos", data: {title: "user one"}, operation: "create"});
      await flush();

      // Rapid stop() immediately followed by start() for a DIFFERENT user —
      // this is the exact interleaving the original bug hit: stop() re-reads
      // the module-level `persister` after awaiting a debounced save(), and
      // an interleaved start() for the new user had already replaced it,
      // destroying the NEW user's persister instead of the old one (leaving
      // mutate() throwing for the new user). Do NOT await stop() before
      // calling start() — that's the whole point of "rapid".
      harness.auth.setUserId("u2");
      const stopPromise = client.stop();
      const startPromise = client.start();
      await Promise.all([stopPromise, startPromise]);

      // The new user's session must be fully functional: mutate() succeeds
      // and the entity persists through its own persister.
      const {id, mutationId} = client.mutate({
        collection: "todos",
        data: {title: "user two"},
        operation: "create",
      });
      expect(client.store.getEntity({collection: "todos", id})?.data).toEqual({title: "user two"});
      expect(client.outbox.getMutation({mutationId})).toBeDefined();
      expect(client.store.getLastUserId()).toBe("u2");
      await client.stop();

      // Re-opening under the same name for u2 must load what was just
      // written — proving the persister that survived the race was u2's, not
      // a destroyed/half-wired one.
      const reopened = createSyncDb({...harness.config, name});
      harness.auth.setUserId("u2");
      await reopened.start();
      expect(reopened.store.listEntities({collection: "todos"}).map((e) => e.data)).toContainEqual({
        title: "user two",
      });
      await reopened.stop();
    });

    it("double start() is a no-op: listeners are not double-registered", async () => {
      const harness = makeHarness();
      let onDeltaCalls = 0;
      let onStatusChangeCalls = 0;
      const countingTransport = {
        ...harness.transport,
        onDelta: (callback: (delta: SyncDelta) => void): (() => void) => {
          onDeltaCalls += 1;
          return harness.transport.onDelta(callback);
        },
        onStatusChange: (
          callback: (status: {connected: boolean; authExpired?: boolean}) => void
        ): (() => void) => {
          onStatusChangeCalls += 1;
          return harness.transport.onStatusChange(callback);
        },
      };
      const client = createSyncDb({...harness.config, transport: countingTransport});
      await client.start();
      expect(onDeltaCalls).toBe(1);
      expect(onStatusChangeCalls).toBe(1);

      // A second start() while already started must be a no-op — no new
      // listener registration, no thrown error.
      await client.start();
      expect(onDeltaCalls).toBe(1);
      expect(onStatusChangeCalls).toBe(1);

      // The client is still fully functional (the first start() "won").
      const {mutationId} = client.mutate({
        collection: "todos",
        data: {title: "still works"},
        operation: "create",
      });
      expect(client.outbox.getMutation({mutationId})).toBeDefined();
      await client.stop();
    });

    it("stop() disposes the coordinator's armed wake-up timer (A3) so no post-stop send fires", async () => {
      const harness = makeHarness();
      harness.transport.setDefaultResponder(() => {
        throw new Error("transient failure");
      });
      const client = createSyncDb(harness.config);
      await client.start();
      client.mutate({collection: "todos", data: {title: "x"}, operation: "create"});
      await flush();
      // The failed send armed a jittered backoff wake-up timer.
      expect(client.getSyncStatus().queuedCount).toBe(1);

      await client.stop();
      const sentBeforeWait = harness.transport.sentMutations.length;
      // Advance well past any plausible backoff window; if the timer were
      // still armed post-stop it would fire another send here.
      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(harness.transport.sentMutations.length).toBe(sentBeforeWait);
    });
  });

  describe("schema versioning (E2)", () => {
    it("wipes and re-bootstraps when the persisted schemaVersion is stale", async () => {
      const name = uniqueName();
      const harness = makeHarness({name});
      const client = createSyncDb(harness.config);
      await client.start();
      client.store.upsertEntity({collection: "todos", data: {title: "v1 data"}, id: "t1", seq: 1});
      // Simulate a persisted store written under an OLDER schema version.
      client.store.raw.setValue("schemaVersion", 0);
      await flush();
      await client.stop();

      // Seed a snapshot page (keyed by the discovered stream — C2) so the
      // re-bootstrap after the wipe has something to fetch and the test can
      // prove it actually ran.
      const second = makeHarness({name});
      second.http.state.pages[DEFAULT_STREAM] = {
        cursor: 5,
        entities: [{data: {title: "from server"}, deleted: false, id: "server-1", seq: 5}],
        frontierSeq: 5,
        hasMore: false,
        oldestRetainedSeq: 0,
        stream: DEFAULT_STREAM,
      };
      const reopened = createSyncDb(second.config);
      await reopened.start();
      await flush();

      // The stale v1 data is gone (wiped, not merged) and the fresh
      // re-bootstrap populated the store from the server instead.
      expect(reopened.store.getEntity({collection: "todos", id: "t1"})).toBeUndefined();
      expect(reopened.store.getEntity({collection: "todos", id: "server-1"})?.data).toEqual({
        title: "from server",
      });
      expect(reopened.store.getSchemaVersion()).toBe(SYNC_SCHEMA_VERSION);
      await reopened.stop();
    });

    it("leaves data untouched when the persisted schemaVersion already matches", async () => {
      const name = uniqueName();
      const harness = makeHarness({name});
      const client = createSyncDb(harness.config);
      await client.start();
      client.store.upsertEntity({collection: "todos", data: {title: "current"}, id: "t1", seq: 1});
      await flush();
      await client.stop();

      const second = makeHarness({name});
      const reopened = createSyncDb(second.config);
      await reopened.start();
      await flush();

      expect(reopened.store.getEntity({collection: "todos", id: "t1"})?.data).toEqual({
        title: "current",
      });
      expect(reopened.store.getSchemaVersion()).toBe(SYNC_SCHEMA_VERSION);
      await reopened.stop();
    });

    it("stamps the current schema version on a genuinely fresh store", async () => {
      const harness = makeHarness();
      const client = createSyncDb(harness.config);
      await client.start();
      expect(client.store.getSchemaVersion()).toBe(SYNC_SCHEMA_VERSION);
      await client.stop();
    });
  });

  describe("persistence failure surfaces (E3)", () => {
    // These tests exercise the REAL web persister factory (encrypted
    // IndexedDB) rather than the memoryPersisterFactory default used
    // elsewhere in this file: under plain bun/Node (no Metro/webpack platform
    // resolution), importing "./persisters/defaultPersisterFactory" always
    // resolves to the neutral in-memory fallback, never the `.web.ts`
    // variant — so `client.ts`'s own E3 hooks (built for that default-factory
    // branch) are unreachable unless the test supplies the web factory
    // directly as `persisterFactory`. The client passes its hooks through to
    // ANY factory via the `hooks` argument (see `PersisterFactory`), so a
    // directly-supplied web factory still wires up SyncStatus surfacing
    // exactly as production code would under Metro/webpack.
    const makeWebPersisterFactory = (
      overrides: Parameters<typeof createWebPersisterFactory>[0] = {}
    ): SyncDbConfig["persisterFactory"] =>
      createWebPersisterFactory({
        keyProvider: createLocalKeyProvider({cacheDbName: uniqueName()}),
        saveDebounceMs: 0,
        ...overrides,
      });

    it("a quota-exceeded save surfaces persistence: 'error' on SyncStatus", async () => {
      const harness = makeHarness({
        persisterFactory: makeWebPersisterFactory({
          idbSetImpl: async () => {
            const error = new Error("The quota has been exceeded.");
            error.name = "QuotaExceededError";
            throw error;
          },
        }),
      });
      let statusChanges = 0;
      const client = createSyncDb(harness.config);
      const unsubscribe = client.onStatusChange(() => {
        statusChanges += 1;
      });
      // The very first startAutoSave() save already goes through the failing
      // idbSetImpl, so persistence surfaces "error" immediately on start() —
      // this is the correct, intentional behavior (a save failure is a save
      // failure regardless of whether the store was empty or not).
      await client.start();
      client.mutate({collection: "todos", data: {title: "x"}, operation: "create"});
      await flush();

      expect(client.getSyncStatus().persistence).toBe("error");
      expect(statusChanges).toBeGreaterThan(0);
      unsubscribe();
      await client.stop();
    });

    it("invokes the configured onDecryptFailure hook instead of the default wipe", async () => {
      const name = uniqueName();
      const keyProvider = createLocalKeyProvider({cacheDbName: uniqueName()});
      const harness = makeHarness({
        name,
        persisterFactory: createWebPersisterFactory({keyProvider, saveDebounceMs: 0}),
      });
      const client = createSyncDb(harness.config);
      await client.start();
      client.mutate({collection: "todos", data: {title: "keep"}, operation: "create"});
      await flush();
      await client.stop();

      let decryptFailureCalls = 0;
      const second = makeHarness({
        name,
        onDecryptFailure: () => {
          decryptFailureCalls += 1;
        },
        persisterFactory: createWebPersisterFactory({
          idbGetImpl: async <T>(): Promise<T | undefined> =>
            new Uint8Array([1, 2, 3, 4, 5]) as unknown as T,
          keyProvider,
          saveDebounceMs: 0,
        }),
      });
      const reopened = createSyncDb(second.config);
      await reopened.start();
      await flush();

      expect(decryptFailureCalls).toBe(1);
      await reopened.stop();
    });

    it("a clean stop() flushes a pending write before destroying the persister", async () => {
      const name = uniqueName();
      const keyProvider = createLocalKeyProvider({cacheDbName: uniqueName()});
      const harness = makeHarness({
        name,
        persisterFactory: createWebPersisterFactory({keyProvider, saveDebounceMs: 0}),
      });
      const client = createSyncDb(harness.config);
      await client.start();
      client.mutate({collection: "todos", data: {title: "before stop"}, operation: "create"});
      // Let the transaction-triggered autosave settle before stop()'s own
      // flush — see encryptedIndexedDbPersister.test.ts's
      // "destroy() flushes a pending debounced save and writes nothing after"
      // for the narrower, race-free version of this same guarantee at the
      // persister level.
      await flush();
      await client.stop();

      const reopened = createSyncDb({
        ...harness.config,
        persisterFactory: createWebPersisterFactory({keyProvider, saveDebounceMs: 0}),
      });
      await reopened.start();
      await flush();
      expect(
        reopened.store.listEntities({collection: "todos"}).map((entity) => entity.data)
      ).toContainEqual({title: "before stop"});
      await reopened.stop();
    });

    it("a different-user login clears the cached derived encryption key (E3f)", async () => {
      // No custom keyProvider/cacheDbName here: `client.ts`'s different-user
      // wipe path clears `DEFAULT_KEY_CACHE_DB_NAME` specifically (the
      // default local key provider's cache database), so this test must
      // exercise that exact default. The test builds the web persister
      // factory directly (bypassing client.ts's own userId-aware factory
      // construction — see the describe-level comment on why), so the
      // cached key's scope key is "local:local" (no userId override) rather
      // than the "local:{userId}" shape client.ts's own default path uses;
      // either way it lives in the same DEFAULT_KEY_CACHE_DB_NAME database
      // client.ts wipes.
      const harness = makeHarness({
        persisterFactory: createWebPersisterFactory({saveDebounceMs: 0}),
      });
      const client = createSyncDb(harness.config);
      await client.start();
      await flush();
      // The default local key provider derives and caches a key on first use
      // (during the initial autoload/autosave above).
      expect(
        await idbGet<CryptoKey>({databaseName: DEFAULT_KEY_CACHE_DB_NAME, key: "local:local"})
      ).toBeInstanceOf(CryptoKey);

      harness.auth.setUserId("u2");
      harness.auth.emitAuthChange();
      await flush();

      expect(
        await idbGet<CryptoKey>({databaseName: DEFAULT_KEY_CACHE_DB_NAME, key: "local:local"})
      ).toBeUndefined();
      await client.stop();
    });
  });

  describe("client-side tombstone compaction (E5)", () => {
    it("a successful reconcile compacts tombstones older than the retention window", async () => {
      const harness = makeHarness({tombstoneRetentionMs: 90 * 24 * 60 * 60 * 1_000});
      const client = createSyncDb(harness.config);
      await client.start();
      await flush();

      // A tombstone applied via a delta, stamped at the current (mocked) clock time.
      harness.transport.deliverDelta({
        collection: "todos",
        deleted: true,
        id: "old-tombstone",
        method: "delete",
        seq: 1,
        stream: "todos|owner:u1",
      });
      expect(client.store.getEntity({collection: "todos", id: "old-tombstone"})?.deleted).toBe(
        true
      );

      // Advance the clock past the retention window, then trigger a
      // reconcile (which must succeed for compaction to run at all).
      harness.clock.value += 91 * 24 * 60 * 60 * 1_000;
      await client.reconcile();

      expect(client.store.getEntity({collection: "todos", id: "old-tombstone"})).toBeUndefined();
      await client.stop();
    });

    it("does not compact tombstones still within the retention window", async () => {
      const harness = makeHarness({tombstoneRetentionMs: 90 * 24 * 60 * 60 * 1_000});
      const client = createSyncDb(harness.config);
      await client.start();
      await flush();

      harness.transport.deliverDelta({
        collection: "todos",
        deleted: true,
        id: "fresh-tombstone",
        method: "delete",
        seq: 1,
        stream: "todos|owner:u1",
      });

      harness.clock.value += 5 * 24 * 60 * 60 * 1_000;
      await client.reconcile();

      expect(client.store.getEntity({collection: "todos", id: "fresh-tombstone"})?.deleted).toBe(
        true
      );
      await client.stop();
    });

    it("tombstoneRetentionMs: 0 disables compaction entirely", async () => {
      const harness = makeHarness({tombstoneRetentionMs: 0});
      const client = createSyncDb(harness.config);
      await client.start();
      await flush();

      harness.transport.deliverDelta({
        collection: "todos",
        deleted: true,
        id: "never-compacted",
        method: "delete",
        seq: 1,
        stream: "todos|owner:u1",
      });

      harness.clock.value += 365 * 24 * 60 * 60 * 1_000;
      await client.reconcile();

      expect(client.store.getEntity({collection: "todos", id: "never-compacted"})?.deleted).toBe(
        true
      );
      await client.stop();
    });
  });
});
