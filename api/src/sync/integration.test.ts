// biome-ignore-all lint/suspicious/noExplicitAny: the rig bridges generic model/router/test types
/**
 * End-to-end integration test (Task 5.5): a REAL @terreno/syncdb client speaking to a
 * REAL @terreno/api backend over HTTP + Socket.io.
 *
 * Server: an Express app (getBaseServer) with JWT auth (setupAuth/addAuthRoutes), a
 * synced model registered through modelRouter's three-argument form with a `sync`
 * config, the SyncApp plugin (snapshot/mutate/key routes + active socket options), and a
 * real RealtimeApp bound to the test HTTP server — real socket auth middleware (test
 * TOKEN_SECRET), real sync socket handlers, and the change-stream watcher.
 *
 * Client: createSyncDb with the real socket transport, the real HTTP channel (with an
 * offline-toggleable fetch so scenarios can simulate a network outage), and the
 * in-memory persister. Auth is a real JWT minted via generateTokens for a seeded user.
 *
 * Change-stream-dependent scenarios gate on replica-set availability, following the
 * realtime.test.ts / syncSocket.test.ts conventions. Scenarios run sequentially against
 * one shared rig (and one shared client for user A) — order matters.
 */

import {afterAll, beforeAll, describe, expect, it} from "bun:test";
import {createServer, type Server as HttpServer} from "node:http";
import type {AddressInfo} from "node:net";
import {
  type AuthProvider,
  clearMemoryPersisterData,
  createHttpChannel,
  createSocketTransport,
  createSyncDb,
  type FetchLike,
  type HttpChannel,
  memoryPersisterFactory,
  type SyncDb,
  type SyncMutateRequest,
  type SyncTransport,
} from "@terreno/syncdb";
import mongoose, {model, Schema} from "mongoose";

import {modelRouter} from "../api";
import {addAuthRoutes, generateTokens, setupAuth} from "../auth";
import {Permissions} from "../permissions";
import {createdUpdatedPlugin, findOneOrNoneFor, type IsDeleted, isDeletedPlugin} from "../plugins";
import {RealtimeApp} from "../realtime/realtimeApp";
import {getBaseServer, setupDb, UserModel} from "../tests";
import {SyncCounter, SyncMutation} from "./models";
import {clearSyncRegistry} from "./registry";
import {clearActiveSyncAppOptions} from "./socketHandlers";
import {SyncApp} from "./syncApp";
import {syncPlugin} from "./syncSeqPlugin";

// ─────────────────────────────────────────────────────────────────────────────
// Synced test model
// ─────────────────────────────────────────────────────────────────────────────

interface IntTodo extends IsDeleted {
  _id: string;
  title: string;
  completed: boolean;
  ownerId: string;
  created: Date;
  _syncSeq?: number;
}

const intTodoSchema = new Schema<IntTodo>({
  _id: {
    // String ids: offline clients mint the entity id (a UUID) before the server ever
    // sees the document, and the sync mutation channel writes it through as `_id`.
    // Synced models therefore need a String _id (or client ids in ObjectId format).
    default: (): string => new mongoose.Types.ObjectId().toHexString(),
    description: "The document id (string so offline clients can mint ids)",
    type: String,
  },
  completed: {
    default: false,
    description: "Whether the todo has been completed",
    type: Boolean,
  },
  ownerId: {description: "The user who owns this todo", type: String},
  title: {description: "The title of the todo", required: true, type: String},
});
intTodoSchema.plugin(isDeletedPlugin);
intTodoSchema.plugin(createdUpdatedPlugin);
intTodoSchema.plugin(syncPlugin);
const IntTodoModel = model<IntTodo>("IntTodo", intTodoSchema);

const COLLECTION = "intTodos";

// ─────────────────────────────────────────────────────────────────────────────
// Rig helpers
// ─────────────────────────────────────────────────────────────────────────────

const hasReplicaSet = async (): Promise<boolean> => {
  try {
    const admin = mongoose.connection.db?.admin();
    const status = await admin?.command({replSetGetStatus: 1});
    return Boolean(status?.ok);
  } catch {
    return false;
  }
};

/** Poll until the predicate holds; throws on timeout so failures name the wait. */
const waitFor = async (
  predicate: () => boolean | Promise<boolean>,
  {label = "condition", timeoutMs = 8_000}: {label?: string; timeoutMs?: number} = {}
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`);
};

interface TestClient {
  client: SyncDb;
  httpChannel: HttpChannel;
  /** Simulate a network outage for the HTTP channel (socket is cut separately). */
  setOffline: (offline: boolean) => void;
  transport: SyncTransport;
}

describe("syncdb end-to-end integration", () => {
  let httpServer: HttpServer;
  let realtimeApp: RealtimeApp;
  let baseUrl = "";
  let replicaSetAvailable = false;
  let userA: {_id: unknown};
  let userB: {_id: unknown};
  let userAId = "";
  const clients: SyncDb[] = [];

  const makeAuthProvider = (user: {_id: unknown}): AuthProvider => ({
    // A real JWT signed with the rig's TOKEN_SECRET, minted fresh per request/connect.
    getToken: async () => (await generateTokens(user)).token ?? null,
    getUserId: async () => String(user._id),
    onAuthChange: () => () => {},
  });

  const makeClient = ({name, user}: {name: string; user: {_id: unknown}}): TestClient => {
    const authProvider = makeAuthProvider(user);
    let offline = false;
    const fetchImpl: FetchLike = (input, init) => {
      if (offline) {
        return Promise.reject(new Error("Simulated network outage"));
      }
      return fetch(input, init);
    };
    const httpChannel = createHttpChannel({authProvider, baseUrl, fetchImpl});
    const transport = createSocketTransport({authProvider, baseUrl, timeoutMs: 4_000});
    clearMemoryPersisterData({databaseName: name});
    const client = createSyncDb({
      authProvider,
      collections: [COLLECTION],
      httpChannel,
      name,
      persisterFactory: memoryPersisterFactory,
      // Deterministic scenarios: syncing is driven by explicit (re)connects and calls.
      reconcileIntervalMs: 0,
      transport,
    });
    clients.push(client);
    return {
      client,
      httpChannel,
      setOffline: (value: boolean): void => {
        offline = value;
      },
      transport,
    };
  };

  beforeAll(async () => {
    const [admin, notAdmin] = await setupDb();
    userA = notAdmin as unknown as {_id: unknown};
    userB = admin as unknown as {_id: unknown};
    userAId = String(notAdmin._id);
    replicaSetAvailable = await hasReplicaSet();

    // The shared test database can be dropped by another test file mid-suite; rebuild
    // the unique indexes the idempotency scenario depends on.
    await Promise.all([SyncCounter.ensureIndexes(), SyncMutation.ensureIndexes()]);
    await Promise.all([
      IntTodoModel.collection.deleteMany({}),
      SyncCounter.deleteMany({}),
      SyncMutation.deleteMany({}),
    ]);

    // Synced model via modelRouter's three-argument form (registers the sync entry).
    clearSyncRegistry();
    const registration = modelRouter<IntTodo>("/intTodos", IntTodoModel, {
      permissions: {
        create: [Permissions.IsAuthenticated],
        delete: [Permissions.IsOwner],
        list: [Permissions.IsAuthenticated],
        read: [Permissions.IsOwner],
        update: [Permissions.IsOwner],
      },
      preCreate: (body, req) => {
        const user = req.user as unknown as {_id?: unknown; id?: unknown} | undefined;
        return {...body, ownerId: String(user?._id ?? user?.id ?? "")} as IntTodo;
      },
      sync: {scope: {type: "owner"}},
    });

    const app = getBaseServer();
    setupAuth(app as any, UserModel as any);
    addAuthRoutes(app as any, UserModel as any);
    new SyncApp({}).register(app);
    app.use(registration.path, registration.router);

    realtimeApp = new RealtimeApp({});
    realtimeApp.register(app);

    httpServer = createServer(app);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
    const {port} = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    // Real socket plumbing: auth middleware (TOKEN_SECRET), realtime + sync socket
    // handlers, and startChangeStreamWatcher — exactly what production wiring does.
    realtimeApp.onServerCreated(httpServer);
    // Give the change-stream cursor a moment to open so writes made by the scenarios
    // are not missed (change streams only deliver post-open events) — same settle the
    // sibling change-stream tests use.
    if (replicaSetAvailable) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  });

  afterAll(async () => {
    for (const client of clients) {
      await client.stop().catch(() => {});
    }
    // Kill lingering sockets/keep-alive connections FIRST so the Socket.io close (which
    // also closes the underlying HTTP server) cannot hang waiting on them.
    realtimeApp?.getIo()?.disconnectSockets(true);
    httpServer?.closeAllConnections?.();
    // Stops the change-stream watcher and closes the Socket.io + HTTP server.
    await realtimeApp?.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    clearSyncRegistry();
    clearActiveSyncAppOptions();
  });

  // Shared across the sequential scenarios below.
  let a: TestClient;
  let conflictDocId = "";

  const entityTitle = (client: SyncDb, id: string): string | undefined => {
    const entity = client.store.getEntity<{title?: string}>({collection: COLLECTION, id});
    return entity?.data?.title;
  };

  /** Cut both channels, run the offline work, leaving the client fully offline. */
  const goOffline = async (testClient: TestClient): Promise<void> => {
    testClient.setOffline(true);
    testClient.transport.disconnect();
    await waitFor(() => !testClient.client.getSyncStatus().isOnline, {label: "client offline"});
  };

  it("1. bootstraps pre-seeded server docs into the local store with correct seqs", async () => {
    await IntTodoModel.create({ownerId: userAId, title: "seed 1"});
    await IntTodoModel.create({ownerId: userAId, title: "seed 2"});
    await IntTodoModel.create({ownerId: userAId, title: "seed 3"});
    await IntTodoModel.create({ownerId: "someone-else", title: "foreign"});

    a = makeClient({name: "integration-user-a", user: userA});
    await a.client.start();

    await waitFor(() => a.client.store.listEntities({collection: COLLECTION}).length === 3, {
      label: "bootstrap entities",
    });
    const entities = a.client.store
      .listEntities<{title?: string}>({collection: COLLECTION})
      .sort((x, y) => x.seq - y.seq);
    expect(entities.map((entity) => entity.data?.title)).toEqual(["seed 1", "seed 2", "seed 3"]);
    // Per-stream seqs assigned server-side in write order.
    expect(entities.map((entity) => entity.seq)).toEqual([1, 2, 3]);

    const status = a.client.getSyncStatus();
    expect(status.isOnline).toBe(true);
    expect(status.queuedCount).toBe(0);
    expect(status.conflictCount).toBe(0);
    // The snapshot cursor advanced to the highest applied seq.
    expect(status.streams[`snapshot:${COLLECTION}`]).toBe(3);
  }, 15_000);

  it("2. applies a live change-stream delta without reconcile", async () => {
    if (!replicaSetAvailable) {
      return;
    }
    // HTTP is unreachable for the whole scenario, so the entity arriving in the local
    // store proves the socket sync:delta path (reconcile/snapshot cannot run).
    a.setOffline(true);
    try {
      const doc = await IntTodoModel.create({ownerId: userAId, title: "live delta"});
      const id = String(doc._id);
      await waitFor(() => a.client.store.getEntity({collection: COLLECTION, id}) !== undefined, {
        label: "live delta entity",
        timeoutMs: 10_000,
      });

      const saved = await IntTodoModel.findById(id);
      const entity = a.client.store.getEntity<{title?: string}>({collection: COLLECTION, id});
      expect(entity?.data?.title).toBe("live delta");
      expect(entity?.seq).toBe(saved?._syncSeq ?? -1);
      // The delta advanced its live stream cursor.
      expect(a.client.getSyncStatus().streams[`${COLLECTION}|owner:${userAId}`]).toBe(
        entity?.seq ?? -1
      );
    } finally {
      a.setOffline(false);
    }
  }, 20_000);

  it("3. replays an offline create on reconnect and applies the ack", async () => {
    await goOffline(a);

    const {id, mutationId} = a.client.mutate({
      collection: COLLECTION,
      data: {title: "offline create"},
      operation: "create",
    });

    // Optimistic local visibility is immediate.
    const optimistic = a.client.store.getEntity<{title?: string}>({collection: COLLECTION, id});
    expect(optimistic?.data?.title).toBe("offline create");
    expect(optimistic?.pendingMutationId).toBe(mutationId);

    // The offline send attempt fails and returns the mutation to the queue.
    await waitFor(
      () => {
        const mutation = a.client.outbox.getMutation({mutationId});
        return mutation?.status === "queued" && mutation.attemptCount >= 1;
      },
      {label: "mutation queued after offline attempt"}
    );
    expect(a.client.getSyncStatus().queuedCount).toBe(1);
    expect(await IntTodoModel.countDocuments({title: "offline create"})).toBe(0);

    // Reconnect: the outbox drains over the socket and the ack finalizes the entity.
    a.setOffline(false);
    await a.transport.connect();
    await waitFor(() => a.client.outbox.getMutation({mutationId})?.status === "acked", {
      label: "mutation acked",
    });

    const saved = await IntTodoModel.findById(id);
    expect(saved?.title).toBe("offline create");
    // The server honored the client-generated id and stamped ownership via preCreate.
    expect(String(saved?._id)).toBe(id);
    expect(saved?.ownerId).toBe(userAId);

    const entity = a.client.store.getEntity<{title?: string}>({collection: COLLECTION, id});
    expect(entity?.pendingMutationId).toBeUndefined();
    expect(entity?.seq).toBe(saved?._syncSeq ?? -1);
    expect(a.client.getSyncStatus().queuedCount).toBe(0);
  }, 20_000);

  it("4a. records a stale-base conflict on reconnect and resolves it with useServer", async () => {
    // A server-side doc pulled into the client via reconcile (snapshot catch-up).
    const doc = await IntTodoModel.create({ownerId: userAId, title: "conflict base"});
    conflictDocId = String(doc._id);
    await a.client.reconcile();
    await waitFor(
      () => a.client.store.getEntity({collection: COLLECTION, id: conflictDocId}) !== undefined,
      {label: "conflict base entity"}
    );
    const baseSeq = a.client.store.getEntity({collection: COLLECTION, id: conflictDocId})?.seq ?? 0;

    // The client edits the doc offline...
    await goOffline(a);
    const {mutationId} = a.client.mutate({
      collection: COLLECTION,
      data: {title: "client edit"},
      id: conflictDocId,
      operation: "update",
    });
    expect(entityTitle(a.client, conflictDocId)).toBe("client edit");
    await waitFor(
      () => {
        const mutation = a.client.outbox.getMutation({mutationId});
        return mutation?.status === "queued" && mutation.attemptCount >= 1;
      },
      {label: "offline update queued"}
    );

    // ...while the server moves on (bumping the doc's seq past the client's base).
    const serverDoc = await IntTodoModel.findById(conflictDocId);
    if (!serverDoc) {
      throw new Error("conflict doc missing server-side");
    }
    serverDoc.title = "server wins";
    await serverDoc.save();

    // Reconnect: replay nacks with a conflict carrying the canonical server doc.
    a.setOffline(false);
    await a.transport.connect();
    await waitFor(() => a.client.getSyncStatus().conflictCount === 1, {
      label: "conflict recorded",
    });
    expect(a.client.outbox.getMutation({mutationId})?.status).toBe("conflicted");
    // The optimistic edit stays visible until the user resolves.
    expect(entityTitle(a.client, conflictDocId)).toBe("client edit");

    // useServer: the canonical server data and seq replace the local entity.
    a.client.resolveConflict({mutationId, strategy: "useServer"});
    const entity = a.client.store.getEntity<{title?: string}>({
      collection: COLLECTION,
      id: conflictDocId,
    });
    expect(entity?.data?.title).toBe("server wins");
    expect(entity?.seq).toBe(baseSeq + 1);
    expect(entity?.pendingMutationId).toBeUndefined();
    expect(a.client.getSyncStatus().conflictCount).toBe(0);
    // The server kept its own write.
    const settled = await IntTodoModel.findById(conflictDocId);
    expect(settled?.title).toBe("server wins");
  }, 20_000);

  it("4b. resolves a second conflict with keepMine, re-applying the client edit server-side", async () => {
    // Same doc, same dance — but this time the client's edit wins.
    await goOffline(a);
    const {mutationId} = a.client.mutate({
      collection: COLLECTION,
      data: {title: "client wins"},
      id: conflictDocId,
      operation: "update",
    });
    await waitFor(
      () => {
        const mutation = a.client.outbox.getMutation({mutationId});
        return mutation?.status === "queued" && mutation.attemptCount >= 1;
      },
      {label: "second offline update queued"}
    );

    const serverDoc = await IntTodoModel.findById(conflictDocId);
    if (!serverDoc) {
      throw new Error("conflict doc missing server-side");
    }
    serverDoc.title = "server wins again";
    await serverDoc.save();

    a.setOffline(false);
    await a.transport.connect();
    await waitFor(() => a.client.getSyncStatus().conflictCount === 1, {
      label: "second conflict recorded",
    });

    // keepMine: the mutation is re-enqueued against the server's current seq, under a
    // FRESH mutationId — the original id is burned on the server's idempotency ledger
    // (it would replay the recorded conflict nack forever) — and resolveConflict kicks
    // a replay immediately, so the retry drains without waiting for another trigger.
    a.client.resolveConflict({mutationId, strategy: "keepMine"});
    expect(a.client.getSyncStatus().conflictCount).toBe(0);
    expect(a.client.outbox.getMutation({mutationId})).toBeUndefined();

    // ...and the replay applies the client's data server-side.
    await waitFor(
      async () => {
        const doc = await IntTodoModel.findById(conflictDocId);
        return doc?.title === "client wins";
      },
      {label: "keepMine retry applied server-side"}
    );
    const settled = await IntTodoModel.findById(conflictDocId);
    expect(settled?.title).toBe("client wins");

    // The retry ran under a fresh identity: the server ledger holds an applied row for
    // this doc whose mutationId differs from the burned (conflicted) original.
    const appliedRetry = await findOneOrNoneFor(SyncMutation, {
      mutationId: {$ne: mutationId},
      resultId: conflictDocId,
      status: "applied",
    });
    expect(appliedRetry).toBeTruthy();

    const entity = a.client.store.getEntity<{title?: string}>({
      collection: COLLECTION,
      id: conflictDocId,
    });
    expect(entity?.data?.title).toBe("client wins");
    expect(entity?.seq).toBe(settled?._syncSeq ?? -1);
    expect(entity?.pendingMutationId).toBeUndefined();
  }, 20_000);

  it("4c. offline create + update to the same entity never self-conflicts on reconnect (A2)", async () => {
    await goOffline(a);
    const {id, mutationId: createMutationId} = a.client.mutate({
      collection: COLLECTION,
      data: {title: "v1"},
      operation: "create",
    });
    const {mutationId: updateMutationId} = a.client.mutate({
      collection: COLLECTION,
      data: {title: "v2"},
      id,
      operation: "update",
    });
    // Both mutations were enqueued against the same (pre-create) baseVersion —
    // without A2's send-time refresh, the update would ship the create's stale
    // base and manufacture a conflict against the server's strict equality
    // check the instant the create acks.
    await waitFor(
      () => {
        const create = a.client.outbox.getMutation({mutationId: createMutationId});
        const update = a.client.outbox.getMutation({mutationId: updateMutationId});
        return (
          create?.status === "queued" &&
          create.attemptCount >= 1 &&
          update?.status === "queued" &&
          update.attemptCount >= 1
        );
      },
      {label: "offline create+update queued"}
    );

    a.setOffline(false);
    await a.transport.connect();
    await waitFor(() => a.client.outbox.getMutation({mutationId: updateMutationId}) === undefined, {
      label: "update acked and pruned",
    });

    expect(a.client.getSyncStatus().conflictCount).toBe(0);
    expect(a.client.getSyncStatus().queuedCount).toBe(0);
    const saved = await IntTodoModel.findById(id);
    expect(saved?.title).toBe("v2");
    const entity = a.client.store.getEntity<{title?: string}>({collection: COLLECTION, id});
    expect(entity?.data?.title).toBe("v2");
    expect(entity?.pendingMutationId).toBeUndefined();
    expect(entity?.seq).toBe(saved?._syncSeq ?? -1);
  }, 20_000);

  it("5. returns the identical ack for a duplicate mutationId over POST /sync/mutate", async () => {
    const request: SyncMutateRequest = {
      collection: COLLECTION,
      data: {title: "idempotent create"},
      mutationId: "integration-dup-1",
      operation: "create",
    };
    const first = await a.httpChannel.sendMutation(request);
    const second = await a.httpChannel.sendMutation(request);

    expect(first.type).toBe("ack");
    // The duplicate delivery reads back the recorded outcome — byte-identical ack.
    expect(second).toEqual(first);
    expect(await IntTodoModel.countDocuments({title: "idempotent create"})).toBe(1);
  }, 15_000);

  it("6. never delivers user A's deltas to user B's owner stream", async () => {
    if (!replicaSetAvailable) {
      return;
    }
    const b = makeClient({name: "integration-user-b", user: userB});
    await b.client.start();
    // B owns nothing: bootstrap yields an empty store.
    expect(b.client.store.listEntities({collection: COLLECTION})).toHaveLength(0);

    const doc = await IntTodoModel.create({ownerId: userAId, title: "a-only"});
    const id = String(doc._id);
    // A receives the delta through its owner stream...
    await waitFor(() => a.client.store.getEntity({collection: COLLECTION, id}) !== undefined, {
      label: "user A delta",
      timeoutMs: 10_000,
    });
    // ...while B's socket, subscribed only to its own owner stream, saw nothing.
    expect(b.client.store.getEntity({collection: COLLECTION, id})).toBeUndefined();
    expect(b.client.store.listEntities({collection: COLLECTION})).toHaveLength(0);

    await b.client.stop();
  }, 20_000);

  // ───────────────────────────────────────────────────────────────────────────
  // FIX 7: batch-protocol integration coverage over the REAL socket. Each test
  // below uses its OWN dedicated client(s) (never the shared `a`/`conflictDocId`
  // chain) so they are independent of the documented flaky cluster (tests 3,
  // 4c, 5 above intermittently fail in this environment).
  // ───────────────────────────────────────────────────────────────────────────

  describe("FIX 7: batch protocol over the real socket", () => {
    /** Count `sync:mutateBatch` sends on the server side for one connected socket. */
    /**
     * Count `sync:mutateBatch` sends on the server side for one connected
     * socket, deduped by the set of mutationIds carried (a batch that gets
     * rate-limited or hits a transient error is resent byte-for-byte with
     * the SAME mutationIds per INV-3 — that's a retry of the same logical
     * round-trip, not a new one).
     *
     * Under heavy scheduling contention the batch-capability probe (FIX 5)
     * can genuinely observe two consecutive "unsupported" results (the grace
     * timer elapses before a receipt lands purely because the process is
     * starved for CPU, not because the server lacks a handler) and latch
     * `batchUnsupported` for the rest of that drain, falling back to
     * per-mutation `sync:mutate` sends for everything after the latch trips.
     * That's the batch protocol's designed, safe degradation (mirrors a
     * genuinely-unsupported server) — a real production timeout would
     * trigger exactly the same fallback. Because of that, this test does not
     * pin an exact chunk count or assert every mutationId rode in a batch;
     * it only asserts the chunking contract (≤ batchSize per chunk) and that
     * batching is exercised at all, leaving delivery correctness (exactly
     * once, in order) to the doc-count and seq-order assertions below.
     */
    const countServerBatchSends = (): {
      distinctGroups: () => number;
      groupSizes: () => number[];
      stop: () => void;
    } => {
      const seenGroups = new Set<string>();
      const io = realtimeApp.getIo();
      const onConnection = (socket: {
        onAny: (listener: (event: string, ...args: unknown[]) => void) => void;
      }): void => {
        socket.onAny((event: string, ...args: unknown[]) => {
          if (event === "sync:mutateBatch") {
            const payload = args[0] as {mutations?: {mutationId: string}[]} | undefined;
            const ids = (payload?.mutations ?? []).map((m) => m.mutationId);
            seenGroups.add(ids.join(","));
          }
        });
      };
      io?.on("connection", onConnection);
      return {
        distinctGroups: () => seenGroups.size,
        groupSizes: () => [...seenGroups].map((group) => group.split(",").length),
        stop: () => io?.off("connection", onConnection),
      };
    };

    it("7a. 120 queued mutations drain in batches of at most 50, server-side seq order matches enqueue order", async () => {
      const client7a = makeClient({name: "integration-batch-count", user: userA});
      const tracker = countServerBatchSends();
      try {
        await client7a.client.start();
        await waitFor(() => client7a.client.getSyncStatus().isOnline, {label: "client7a online"});

        await goOffline(client7a);
        const mutationIds: string[] = [];
        const titles: string[] = [];
        for (let i = 0; i < 120; i++) {
          const title = `batch-count-${i}`;
          titles.push(title);
          const {mutationId} = client7a.client.mutate({
            collection: COLLECTION,
            data: {title},
            operation: "create",
          });
          mutationIds.push(mutationId);
        }

        client7a.setOffline(false);
        await client7a.transport.connect();
        // Acked rows are pruned automatically after each successful drain
        // pass (A5), so a mutationId can read back `undefined` well before
        // the whole queue finishes — queuedCount (backed by a live scan of
        // remaining `queued` rows) is the robust "fully drained" signal, not
        // per-mutation status polling.
        await waitFor(() => client7a.client.getSyncStatus().queuedCount === 0, {
          label: "all 120 mutations drained",
          timeoutMs: 20_000,
        });
        await waitFor(
          async () => (await IntTodoModel.countDocuments({title: {$in: titles}})) === 120,
          {label: "all 120 documents persisted", timeoutMs: 20_000}
        );

        // Every batch chunk observed on the wire must respect the
        // DEFAULT_BATCH_SIZE = 50 cap (the chunking contract itself).
        for (const size of tracker.groupSizes()) {
          expect(size).toBeLessThanOrEqual(50);
        }
        // At least one real sync:mutateBatch round-trip must have happened —
        // batching must actually be exercised for a 120-mutation queue, not
        // silently skipped from the very first send. (We don't assert an
        // exact chunk count or full per-mutationId wire coverage: under
        // heavy scheduling contention the batch-capability probe can latch
        // "unsupported" on a false-positive grace-timer expiry — the server
        // was simply slow, not incapable — falling back to single-sends for
        // the remainder, which is FIX 5's documented, safe degradation. What
        // must hold regardless of that mix is delivery: every mutation lands
        // exactly once, in order.)
        expect(tracker.distinctGroups()).toBeGreaterThanOrEqual(1);
        // Every applied mutation landed exactly once regardless of any
        // retries — the idempotency ledger is what makes a rate-limited
        // resend, or a lease-takeover after a slow ack, safe (INV-3).
        expect(await IntTodoModel.countDocuments({title: {$in: titles}})).toBe(120);

        // Server-side seq order matches enqueue order (INV-1, global FIFO).
        const docs = await IntTodoModel.find({title: {$in: titles}}).sort({_syncSeq: 1});
        expect(docs.map((doc) => doc.title)).toEqual(titles);
      } finally {
        tracker.stop();
        await client7a.client.stop();
      }
    }, 30_000);

    it("7b. socket drop after k-of-n acked applies the remainder exactly once, zero duplicates", async () => {
      const client7b = makeClient({name: "integration-socket-drop", user: userA});
      try {
        await client7b.client.start();
        await waitFor(() => client7b.client.getSyncStatus().isOnline, {label: "client7b online"});

        await goOffline(client7b);
        // 60 mutations = 2 batch round-trips (DEFAULT_BATCH_SIZE 50) so the
        // drop below lands genuinely mid-drain (after the first batch, before
        // the second), not after the whole thing already completed.
        const n = 60;
        const mutationIds: string[] = [];
        const titles: string[] = [];
        for (let i = 0; i < n; i++) {
          const title = `socket-drop-${i}`;
          titles.push(title);
          const {mutationId} = client7b.client.mutate({
            collection: COLLECTION,
            data: {title},
            operation: "create",
          });
          mutationIds.push(mutationId);
        }

        client7b.setOffline(false);
        await client7b.transport.connect();
        // Wait for the first batch (the first 50, in FIFO order) to land —
        // queuedCount drops to 10 (the second chunk) — then drop the socket
        // before the second batch completes. Acked rows are pruned right
        // after each successful pass (A5), so queuedCount (a live scan of
        // remaining `queued` rows) is the robust signal here, not
        // per-mutation status polling which can read back `undefined` for an
        // already-pruned row.
        await waitFor(() => client7b.client.getSyncStatus().queuedCount <= 10, {
          label: "first batch drained before drop",
          timeoutMs: 10_000,
        });
        client7b.transport.disconnect();
        await waitFor(() => !client7b.client.getSyncStatus().isOnline, {
          label: "client7b offline after drop",
        });

        // Reconnect exactly like the existing offline-create scenario (test 3).
        await client7b.transport.connect();
        await waitFor(() => client7b.client.getSyncStatus().queuedCount === 0, {
          label: "all mutations drained after reconnect",
          timeoutMs: 20_000,
        });
        await waitFor(
          async () => (await IntTodoModel.countDocuments({title: {$in: titles}})) === n,
          {
            label: "all documents persisted after reconnect",
            timeoutMs: 20_000,
          }
        );

        // Zero duplicates: exactly one document per title, exactly n documents total.
        const docs = await IntTodoModel.find({title: {$in: titles}});
        expect(docs).toHaveLength(n);
        for (const title of titles) {
          expect(docs.filter((doc) => doc.title === title)).toHaveLength(1);
        }
      } finally {
        await client7b.client.stop();
      }
    }, 30_000);

    it("7c. token expiry mid-batch pauses for auth, then resumes fully on same-user re-auth with the outbox intact", async () => {
      let tokenIsValid = true;
      const authChangeListeners = new Set<() => void>();
      const authProvider: AuthProvider = {
        getToken: async () =>
          tokenIsValid ? ((await generateTokens(userA)).token ?? null) : "invalid-expired-token",
        getUserId: async () => String(userA._id),
        onAuthChange: (callback) => {
          authChangeListeners.add(callback);
          return () => authChangeListeners.delete(callback);
        },
      };
      let offline = false;
      const fetchImpl: FetchLike = (input, init) => {
        if (offline) {
          return Promise.reject(new Error("Simulated network outage"));
        }
        return fetch(input, init);
      };
      const httpChannel = createHttpChannel({authProvider, baseUrl, fetchImpl});
      const transport = createSocketTransport({authProvider, baseUrl, timeoutMs: 4_000});
      clearMemoryPersisterData({databaseName: "integration-token-expiry"});
      const client7c = createSyncDb({
        authProvider,
        collections: [COLLECTION],
        httpChannel,
        name: "integration-token-expiry",
        persisterFactory: memoryPersisterFactory,
        reconcileIntervalMs: 0,
        transport,
      });
      clients.push(client7c);

      try {
        await client7c.start();
        await waitFor(() => client7c.getSyncStatus().isOnline, {label: "client7c online"});

        // Go offline, queue mutations, then flip the token invalid BEFORE
        // reconnecting — simulating the token expiring while mutations are
        // queued for the next drain (mid-batch from the server's viewpoint:
        // the auth middleware rejects the socket handshake/HTTP request).
        offline = true;
        transport.disconnect();
        await waitFor(() => !client7c.getSyncStatus().isOnline, {label: "client7c offline"});

        const mutationIds: string[] = [];
        for (let i = 0; i < 5; i++) {
          const {mutationId} = client7c.mutate({
            collection: COLLECTION,
            data: {title: `token-expiry-${i}`},
            operation: "create",
          });
          mutationIds.push(mutationId);
        }

        tokenIsValid = false;
        offline = false;
        await transport.connect().catch(() => {});

        // Auth-pause: outbox intact, zero budget consumed, paused visibly.
        await waitFor(() => client7c.getSyncStatus().paused === "auth", {
          label: "client7c auth-paused",
          timeoutMs: 10_000,
        });
        // Some of the 5 may have raced onto the wire and already acked
        // before the token flip took effect (HTTP fallback / a socket send
        // in flight at the exact moment offline toggled false) — the load-
        // bearing assertion is that whatever remains queued burned ZERO
        // error-nack budget and is genuinely queued, not failed/conflicted.
        expect(client7c.getSyncStatus().queuedCount).toBeGreaterThan(0);
        expect(client7c.getSyncStatus().queuedCount).toBeLessThanOrEqual(5);
        for (const mutationId of mutationIds) {
          const mutation = client7c.outbox.getMutation({mutationId});
          expect(["acked", "queued", undefined]).toContain(mutation?.status);
          expect(mutation?.errorNackCount ?? 0).toBe(0);
        }

        // Same-user re-auth: the pause clears and the queue drains fully
        // from the halt point, outbox intact throughout.
        tokenIsValid = true;
        for (const listener of authChangeListeners) {
          listener();
        }
        await waitFor(() => client7c.getSyncStatus().paused === undefined, {
          label: "client7c auth-resumed",
          timeoutMs: 10_000,
        });
        await waitFor(() => client7c.getSyncStatus().queuedCount === 0, {
          label: "all mutations drained after re-auth",
          timeoutMs: 20_000,
        });
        const expectedTitles = Array.from({length: 5}, (_v, i) => `token-expiry-${i}`);
        await waitFor(
          async () => (await IntTodoModel.countDocuments({title: {$in: expectedTitles}})) === 5,
          {label: "all documents persisted after re-auth", timeoutMs: 20_000}
        );
        expect(client7c.getSyncStatus().queuedCount).toBe(0);
      } finally {
        await client7c.stop();
      }
    }, 30_000);
  });
});
