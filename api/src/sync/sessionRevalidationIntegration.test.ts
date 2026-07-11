// biome-ignore-all lint/suspicious/noExplicitAny: the rig bridges generic model/router/test types
/**
 * Integration coverage for D1 (socket session re-validation sweep) and D4
 * (membership revocation vs socket rooms), using a REAL @terreno/syncdb client
 * against a REAL @terreno/api backend — the same rig shape as integration.test.ts,
 * but a dedicated file/registry/server so a short `sessionRevalidationIntervalMs`
 * and a tenant-scoped model don't interact with that file's sequential scenarios.
 *
 * Scenarios:
 * - D1: a disabled user's socket is disconnected by the sweep within one interval,
 *   emitting sync:auth-expired first; the client lands in auth-pause with the
 *   outbox intact (INV-2).
 * - D4: revoking a user's only organization membership mid-session causes the
 *   sweep to leave the tenant's sync room — no further deltas for that org reach
 *   the live socket, even though the connection itself stays up (still a valid,
 *   non-disabled user).
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
  memoryPersisterFactory,
  type SyncDb,
} from "@terreno/syncdb";
import mongoose, {model, Schema} from "mongoose";

import {modelRouter} from "../api";
import {addAuthRoutes, generateTokens, setupAuth} from "../auth";
import {createdUpdatedPlugin, findOneOrNoneFor, type IsDeleted, isDeletedPlugin} from "../plugins";
import {RealtimeApp} from "../realtime/realtimeApp";
import {getBaseServer, setupDb, UserModel} from "../tests";
import {SyncCounter, SyncMutation} from "./models";
import {clearSyncRegistry} from "./registry";
import {clearActiveSyncAppOptions} from "./socketHandlers";
import {SyncApp} from "./syncApp";
import {syncPlugin} from "./syncSeqPlugin";

interface RevalProject extends IsDeleted {
  _id: string;
  title: string;
  organizationId: string;
  created: Date;
  _syncSeq?: number;
}

const revalProjectSchema = new Schema<RevalProject>({
  _id: {
    default: (): string => new mongoose.Types.ObjectId().toHexString(),
    description: "The document id (string so offline clients can mint ids)",
    type: String,
  },
  organizationId: {description: "Tenant organization id", type: String},
  title: {description: "Project title", required: true, type: String},
});
revalProjectSchema.plugin(isDeletedPlugin);
revalProjectSchema.plugin(createdUpdatedPlugin);
revalProjectSchema.plugin(syncPlugin);
const RevalProjectModel = model<RevalProject>("RevalIntegrationProject", revalProjectSchema);

const COLLECTION = "revalProjects";
const SESSION_REVALIDATION_INTERVAL_MS = 200;

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

/** Waits at least `ms`, useful for asserting something did NOT happen by a deadline. */
const settleFor = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Change streams (D4's delta fan-out) require a replica set — mirrors integration.test.ts. */
const hasReplicaSet = async (): Promise<boolean> => {
  try {
    const admin = mongoose.connection.db?.admin();
    const status = await admin?.command({replSetGetStatus: 1});
    return Boolean(status?.ok);
  } catch {
    return false;
  }
};

describe("session re-validation sweep integration (D1/D4)", () => {
  let httpServer: HttpServer;
  let realtimeApp: RealtimeApp;
  let baseUrl = "";
  let userDoc: {_id: unknown};
  let replicaSetAvailable = false;
  const memberships = new Map<string, string[]>();
  const clients: SyncDb[] = [];

  const makeAuthProvider = (user: {_id: unknown}): AuthProvider => ({
    getToken: async () => (await generateTokens(user)).token ?? null,
    getUserId: async () => String(user._id),
    onAuthChange: () => () => {},
  });

  const makeClient = (name: string, user: {_id: unknown}): SyncDb => {
    const authProvider = makeAuthProvider(user);
    const httpChannel = createHttpChannel({authProvider, baseUrl});
    const transport = createSocketTransport({authProvider, baseUrl, timeoutMs: 4_000});
    clearMemoryPersisterData({databaseName: name});
    const client = createSyncDb({
      authProvider,
      collections: [COLLECTION],
      httpChannel,
      name,
      persisterFactory: memoryPersisterFactory,
      reconcileIntervalMs: 0,
      transport,
    });
    clients.push(client);
    return client;
  };

  beforeAll(async () => {
    const [, notAdmin] = await setupDb();
    userDoc = notAdmin as unknown as {_id: unknown};
    memberships.set(String(userDoc._id), ["org-a"]);
    replicaSetAvailable = await hasReplicaSet();

    await Promise.all([SyncCounter.ensureIndexes(), SyncMutation.ensureIndexes()]);
    await Promise.all([
      RevalProjectModel.collection.deleteMany({}),
      SyncCounter.deleteMany({}),
      SyncMutation.deleteMany({}),
    ]);

    clearSyncRegistry();
    const registration = modelRouter<RevalProject>("/revalProjects", RevalProjectModel, {
      permissions: {
        create: [() => true],
        delete: [() => true],
        list: [() => true],
        read: [() => true],
        update: [() => true],
      },
      preCreate: (body) => body as RevalProject,
      sync: {scope: {field: "organizationId", type: "tenant"}},
    });

    const app = getBaseServer();
    setupAuth(app as any, UserModel as any);
    addAuthRoutes(app as any, UserModel as any);
    new SyncApp({
      getUserScopes: (user) => memberships.get(String(user.id)) ?? [],
    }).register(app);
    app.use(registration.path, registration.router);

    realtimeApp = new RealtimeApp({
      // D1: a short sweep interval so the tests don't wait a full 60s default.
      sessionRevalidationIntervalMs: SESSION_REVALIDATION_INTERVAL_MS,
      userModel: UserModel as any,
    });
    realtimeApp.register(app);

    httpServer = createServer(app);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => resolve());
    });
    const {port} = httpServer.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;

    realtimeApp.onServerCreated(httpServer);
    // Give the change-stream cursor a moment to open (only delivers post-open
    // events) — same settle the sibling integration/change-stream tests use.
    if (replicaSetAvailable) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  });

  afterAll(async () => {
    for (const client of clients) {
      await client.stop().catch(() => {});
    }
    realtimeApp?.getIo()?.disconnectSockets(true);
    httpServer?.closeAllConnections?.();
    await realtimeApp?.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    clearSyncRegistry();
    clearActiveSyncAppOptions();
  });

  it("D1: the sweep disconnects a disabled user's socket, and the client lands in auth-pause with the outbox intact", async () => {
    const client = makeClient("d1-disabled-user", userDoc);
    await client.start();
    await waitFor(() => client.getSyncStatus().isOnline, {label: "initial connect"});

    // Disable the user mid-session — the sweep should notice within one interval
    // and disconnect the socket (sync:auth-expired). Note: the HTTP channel would
    // ALSO independently 401 on the disabled user (the existing A4 path), so wait
    // for the socket-specific signal (isOnline flipping false) first — the only
    // thing that can disconnect this socket mid-test is the sweep, since nothing
    // else in this scenario touches the transport.
    const fullUser = await findOneOrNoneFor(UserModel as any, {_id: userDoc._id});
    (fullUser as any).disabled = true;
    await (fullUser as any).save();

    await waitFor(() => !client.getSyncStatus().isOnline, {
      label: "socket disconnected by the sweep after being disabled",
      timeoutMs: 5_000,
    });
    await waitFor(() => client.getSyncStatus().paused === "auth", {
      label: "client paused for auth after being disabled",
      timeoutMs: 5_000,
    });
    expect(client.getSyncStatus().isOnline).toBe(false);

    // A mutation made while paused stays queued — nothing is lost, no budget burned.
    const {mutationId} = client.mutate({
      collection: COLLECTION,
      data: {organizationId: "org-a", title: "queued while disabled"},
      operation: "create",
    });
    const mutation = client.outbox.getMutation({mutationId});
    expect(mutation?.status).toBe("queued");
    expect(mutation?.errorNackCount).toBe(0);

    // Re-enable so afterAll's client.stop() and any later scenario aren't left
    // fighting a disabled user; also proves recovery is possible.
    (fullUser as any).disabled = false;
    await (fullUser as any).save();
  }, 15_000);

  it("D4: revoking the user's only organization membership stops further deltas for that tenant on the live socket", async () => {
    if (!replicaSetAvailable) {
      // Deltas are change-stream-driven; without a replica set there is nothing
      // to observe. Same gating convention as api/src/sync/integration.test.ts.
      return;
    }
    const client = makeClient("d4-membership-revoked", userDoc);
    await client.start();
    await waitFor(() => client.getSyncStatus().isOnline, {label: "initial connect"});

    // Confirm the tenant stream is live: a doc created for org-a arrives as a delta.
    const before = await RevalProjectModel.create({
      organizationId: "org-a",
      title: "before revoke",
    });
    await waitFor(
      () => client.store.getEntity({collection: COLLECTION, id: String(before._id)}) !== undefined,
      {label: "delta before revocation", timeoutMs: 5_000}
    );

    // Revoke membership — the sweep should leave the sync:revalProjects|tenant:org-a
    // room within one interval.
    memberships.set(String(userDoc._id), []);
    await settleFor(SESSION_REVALIDATION_INTERVAL_MS * 3);

    // The connection itself stays up (this user is not disabled) — only the
    // stream membership changed.
    expect(client.getSyncStatus().isOnline).toBe(true);
    expect(client.getSyncStatus().paused).toBeUndefined();

    const after = await RevalProjectModel.create({organizationId: "org-a", title: "after revoke"});
    // Give a fair chance for a (wrongly) delivered delta to arrive, then assert it
    // did not.
    await settleFor(1_000);
    expect(client.store.getEntity({collection: COLLECTION, id: String(after._id)})).toBeUndefined();

    // Restore membership for hygiene (afterAll doesn't depend on it, but keeps the
    // shared UserModel doc's expectations obvious to a future reader).
    memberships.set(String(userDoc._id), ["org-a"]);
  }, 20_000);
});
