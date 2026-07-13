// biome-ignore-all lint/suspicious/noExplicitAny: the harness bridges generic model/router/client types, mirroring integration.test.ts
/**
 * This is a manual load-generation script — NOT run by `bun test`. Invoke via
 * `bun run api:load` (see root package.json) or directly:
 *   `bun run api/src/sync/loadHarness.ts [--clients=20] [--seedDocs=5000] [--targetRate=200] [--durationSec=30] [--mongoUri=...] [--port=0]`
 * Requires a real MongoDB replica set (change streams power live delta fan-out).
 *
 * Stands up one in-process Express + Socket.io server with a synced Mongoose model
 * (mirroring `IntTodo` from `sync/integration.test.ts`), then drives N real
 * `@terreno/syncdb` clients (each a distinct owner) against it over real HTTP/socket
 * transports: seeds documents, bootstraps all clients, then issues a mixed
 * create/update/delete mutation load — including deliberate duplicate mutationIds
 * and deliberate update/update conflicts — while measuring:
 *   - mutate round-trip latency (p50/p95/p99)
 *   - change-stream -> sync:delta fan-out lag across all connected sockets
 *   - bootstrap wall time at the seeded doc count
 *   - final-state convergence (each client's local store vs. what Mongo holds)
 *
 * This is a load/perf tool, not a correctness test suite — assertions are logged as
 * pass/fail lines rather than thrown, so a single divergent client doesn't abort the
 * report. The process exits non-zero if any client fails to converge.
 */
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
  listConflicts,
  memoryPersisterFactory,
  type SyncDb,
  type SyncMutateRequest,
  type SyncTransport,
} from "@terreno/syncdb";
import express from "express";
import mongoose, {model, Schema} from "mongoose";
import passportLocalMongoose from "passport-local-mongoose";

import {modelRouter} from "../api";
import {addAuthRoutes, generateTokens, setupAuth} from "../auth";
import {logger} from "../logger";
import {Permissions} from "../permissions";
import {createdUpdatedPlugin, type IsDeleted, isDeletedPlugin} from "../plugins";
import {RealtimeApp} from "../realtime/realtimeApp";
import {clearSyncRegistry} from "./registry";
import {SyncApp} from "./syncApp";
import {syncPlugin} from "./syncSeqPlugin";

// ─────────────────────────────────────────────────────────────────────────────
// CLI flags
// ─────────────────────────────────────────────────────────────────────────────

interface HarnessConfig {
  clients: number;
  seedDocs: number;
  targetRate: number;
  durationSec: number;
  mongoUri: string;
  port: number;
}

/** Simple `--flag=value` argv parser; no CLI framework needed for a one-off script. */
const parseFlags = (argv: string[]): HarnessConfig => {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg);
    if (match) {
      flags.set(match[1], match[2]);
    }
  }
  const num = (key: string, fallback: number): number => {
    const raw = flags.get(key);
    if (raw === undefined) {
      return fallback;
    }
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  return {
    clients: num("clients", 20),
    durationSec: num("durationSec", 30),
    mongoUri:
      flags.get("mongoUri") ??
      process.env.MONGO_URI ??
      "mongodb://127.0.0.1:27017/terreno-sync-load?replicaSet=rs0",
    port: num("port", 0),
    seedDocs: num("seedDocs", 5_000),
    targetRate: num("targetRate", 200),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Synced load-test model (mirrors IntTodo from integration.test.ts)
// ─────────────────────────────────────────────────────────────────────────────

interface LoadTodo extends IsDeleted {
  _id: string;
  title: string;
  completed: boolean;
  ownerId: string;
  created: Date;
  _syncSeq?: number;
}

const loadTodoSchema = new Schema<LoadTodo>({
  _id: {
    default: (): string => new mongoose.Types.ObjectId().toHexString(),
    description: "The document id (string so offline clients can mint ids)",
    type: String,
  },
  completed: {
    default: false,
    description: "Whether the load-test todo has been completed",
    type: Boolean,
  },
  ownerId: {description: "The user who owns this load-test todo", type: String},
  title: {description: "The title of the load-test todo", required: true, type: String},
});
loadTodoSchema.plugin(isDeletedPlugin);
loadTodoSchema.plugin(createdUpdatedPlugin);
loadTodoSchema.plugin(syncPlugin);
const LoadTodoModel = model<LoadTodo>("LoadHarnessTodo", loadTodoSchema);

const COLLECTION = "loadHarnessTodos";

// ─────────────────────────────────────────────────────────────────────────────
// Percentile helper
// ─────────────────────────────────────────────────────────────────────────────

const percentile = (samples: number[], p: number): number => {
  if (samples.length === 0) {
    return 0;
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

// ─────────────────────────────────────────────────────────────────────────────
// Rig helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Poll until the predicate holds, or throw naming the failed wait. */
const waitFor = async (
  predicate: () => boolean | Promise<boolean>,
  {
    label = "condition",
    timeoutMs = 30_000,
    intervalMs = 25,
  }: {
    label?: string;
    timeoutMs?: number;
    intervalMs?: number;
  } = {}
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out after ${timeoutMs}ms waiting for ${label}`);
};

interface HarnessClient {
  name: string;
  user: {_id: unknown};
  ownerId: string;
  client: SyncDb;
  httpChannel: HttpChannel;
  transport: SyncTransport;
}

const makeAuthProvider = (user: {_id: unknown}): AuthProvider => ({
  getToken: async () => (await generateTokens(user)).token ?? null,
  getUserId: async () => String(user._id),
  onAuthChange: () => () => {},
});

const makeHarnessClient = ({
  name,
  user,
  baseUrl,
}: {
  name: string;
  user: {_id: unknown};
  baseUrl: string;
}): HarnessClient => {
  const authProvider = makeAuthProvider(user);
  const fetchImpl: FetchLike = (input, init) => fetch(input, init);
  const httpChannel = createHttpChannel({authProvider, baseUrl, fetchImpl});
  const transport = createSocketTransport({authProvider, baseUrl, timeoutMs: 8_000});
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
  return {client, httpChannel, name, ownerId: String(user._id), transport, user};
};

/** Build the Express + Socket.io rig: synced model, SyncApp, RealtimeApp, listening server. */
const buildRig = async (
  config: HarnessConfig
): Promise<{httpServer: HttpServer; realtimeApp: RealtimeApp; baseUrl: string}> => {
  process.env.TOKEN_SECRET = process.env.TOKEN_SECRET ?? "load-harness-token-secret";
  process.env.TOKEN_ISSUER = process.env.TOKEN_ISSUER ?? "terreno-load-harness";
  process.env.REFRESH_TOKEN_SECRET =
    process.env.REFRESH_TOKEN_SECRET ?? "load-harness-refresh-secret";
  process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "load-harness-session-secret";

  clearSyncRegistry();

  // Fresh User model bound to this script's own mongoose connection. setupAuth requires
  // a passport-local-mongoose-backed model (createStrategy/serializeUser/deserializeUser),
  // even though the harness only ever mints JWTs directly via generateTokens and never
  // exercises the password login route.
  const userSchema = new Schema<{email: string; admin: boolean}>({
    admin: {default: false, description: "Whether the user has admin privileges", type: Boolean},
    email: {description: "The user's email", type: String},
  });
  userSchema.plugin(
    passportLocalMongoose as unknown as (schema: Schema, options?: Record<string, unknown>) => void,
    {usernameField: "email"}
  );
  const UserModel = mongoose.models.LoadHarnessUser ?? model("LoadHarnessUser", userSchema);

  // modelRouter's 3-argument form both registers the sync entry AND returns the
  // Express router to mount, so a single call does both — no need to call it twice.
  const registration = modelRouter<LoadTodo>("/loadHarnessTodos", LoadTodoModel, {
    permissions: {
      create: [Permissions.IsAuthenticated],
      delete: [Permissions.IsOwner],
      list: [Permissions.IsAuthenticated],
      read: [Permissions.IsOwner],
      update: [Permissions.IsOwner],
    },
    preCreate: (body, req) => {
      const user = req.user as unknown as {_id?: unknown; id?: unknown} | undefined;
      return {...body, ownerId: String(user?._id ?? user?.id ?? "")} as LoadTodo;
    },
    sync: {scope: {type: "owner"}},
  });

  const app = express();
  app.use(express.json());
  setupAuth(app as any, UserModel as any);
  addAuthRoutes(app as any, UserModel as any);
  new SyncApp({}).register(app as any);
  app.use(registration.path, registration.router);

  const realtimeApp = new RealtimeApp({});
  realtimeApp.register(app as any);

  const httpServer = createServer(app);
  await new Promise<void>((resolve) => {
    httpServer.listen(config.port, () => resolve());
  });
  const {port} = httpServer.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  realtimeApp.onServerCreated(httpServer);
  // Give the change-stream cursor a moment to open before any writes happen.
  await new Promise((resolve) => setTimeout(resolve, 300));

  return {baseUrl, httpServer, realtimeApp};
};

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

const main = async (): Promise<void> => {
  const config = parseFlags(process.argv.slice(2));
  logger.info("[loadHarness] starting", config as unknown as Record<string, unknown>);

  await mongoose.connect(config.mongoUri);

  await Promise.all([
    LoadTodoModel.collection.deleteMany({}),
    mongoose.connection.db?.collection("syncmutations").deleteMany({}),
    mongoose.connection.db?.collection("synccounters").deleteMany({}),
  ]);

  const {httpServer, realtimeApp, baseUrl} = await buildRig(config);

  let exitCode = 0;
  const harnessClients: HarnessClient[] = [];

  try {
    // ── N users, one owner stream each ──────────────────────────────────────
    const UserModel = mongoose.models.LoadHarnessUser;
    const users: {_id: unknown}[] = [];
    for (let i = 0; i < config.clients; i++) {
      const user = await UserModel.create({admin: false, email: `load-client-${i}@example.com`});
      users.push(user as unknown as {_id: unknown});
    }

    for (let i = 0; i < config.clients; i++) {
      harnessClients.push(makeHarnessClient({baseUrl, name: `load-client-${i}`, user: users[i]}));
    }

    // ── Start all clients, wait for online ──────────────────────────────────
    await Promise.all(harnessClients.map((hc) => hc.client.start()));
    await waitFor(() => harnessClients.every((hc) => hc.client.getSyncStatus().isOnline), {
      label: "all clients online",
      timeoutMs: 30_000,
    });
    logger.info(`[loadHarness] ${harnessClients.length} clients online`);

    // ── Seed docs round-robin across owners; measure bootstrap wall time ────
    const perOwnerCount = new Map<string, number>();
    const seeds = Array.from({length: config.seedDocs}, (_, i) => {
      const owner = harnessClients[i % harnessClients.length];
      perOwnerCount.set(owner.ownerId, (perOwnerCount.get(owner.ownerId) ?? 0) + 1);
      return {ownerId: owner.ownerId, title: `seed-${i}`};
    });

    const bootstrapStart = Date.now();
    if (seeds.length > 0) {
      await LoadTodoModel.insertMany(seeds);
    }

    await waitFor(
      () =>
        harnessClients.every((hc) => {
          const expected = perOwnerCount.get(hc.ownerId) ?? 0;
          return hc.client.store.listEntities({collection: COLLECTION}).length >= expected;
        }),
      {label: `bootstrap convergence at ${config.seedDocs} docs`, timeoutMs: 120_000}
    );
    const bootstrapWallMs = Date.now() - bootstrapStart;
    logger.info(`[loadHarness] bootstrap converged in ${bootstrapWallMs}ms`);

    // ── Driven mutation load ─────────────────────────────────────────────────
    const mutateLatenciesMs: number[] = [];
    const fanoutLagsMs: number[] = [];
    let conflictCount = 0;
    let ackCount = 0;
    let nackCount = 0;
    let duplicateCount = 0;

    /** Poll the outbox for a mutation to reach a terminal status, recording latency. */
    const trackMutation = async (
      hc: HarnessClient,
      mutationId: string,
      startedAt: number
    ): Promise<void> => {
      try {
        await waitFor(
          () => {
            const mutation = hc.client.outbox.getMutation({mutationId});
            return (
              mutation === undefined ||
              mutation.status === "acked" ||
              mutation.status === "conflicted" ||
              mutation.status === "failed"
            );
          },
          {intervalMs: 8, label: `mutation ${mutationId} terminal`, timeoutMs: 15_000}
        );
        mutateLatenciesMs.push(Date.now() - startedAt);
        const mutation = hc.client.outbox.getMutation({mutationId});
        if (mutation?.status === "conflicted") {
          conflictCount += 1;
        } else if (mutation?.status === "failed") {
          nackCount += 1;
        } else {
          ackCount += 1;
        }
      } catch {
        // Timed out waiting; still record whatever elapsed so the report reflects it.
        mutateLatenciesMs.push(Date.now() - startedAt);
      }
    };

    const randomClient = (): HarnessClient =>
      harnessClients[Math.floor(Math.random() * harnessClients.length)];

    const knownEntityIds: {clientIndex: number; id: string}[] = [];
    for (const [i, hc] of harnessClients.entries()) {
      for (const entity of hc.client.store.listEntities({collection: COLLECTION})) {
        knownEntityIds.push({clientIndex: i, id: entity.id});
      }
    }

    const loadPromises: Promise<void>[] = [];
    const intervalMs = 1000 / config.targetRate;
    const loadEnd = Date.now() + config.durationSec * 1000;

    while (Date.now() < loadEnd) {
      const hc = randomClient();
      const opRoll = Math.random();

      if (opRoll < 0.5 || knownEntityIds.length === 0) {
        // Create.
        const startedAt = Date.now();
        const {mutationId} = hc.client.mutate({
          collection: COLLECTION,
          data: {title: `load-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`},
          operation: "create",
        });
        loadPromises.push(trackMutation(hc, mutationId, startedAt));
      } else if (opRoll < 0.85) {
        // Update.
        const target = knownEntityIds[Math.floor(Math.random() * knownEntityIds.length)];
        const owner = harnessClients[target.clientIndex];
        const startedAt = Date.now();
        const {mutationId} = owner.client.mutate({
          collection: COLLECTION,
          data: {title: `updated-${Date.now()}`},
          id: target.id,
          operation: "update",
        });
        loadPromises.push(trackMutation(owner, mutationId, startedAt));

        // Deliberate mid-batch conflict: race a second, server-side write against the
        // SAME entity underneath this client's just-queued optimistic edit, mirroring
        // integration.test.ts's 4a/4b conflict scenarios (server moves on while the
        // client's mutation is still in flight/queued).
        if (Math.random() < 0.1) {
          void LoadTodoModel.findById(target.id)
            .then((doc) => {
              if (!doc) {
                return;
              }
              doc.title = `server-race-${Date.now()}`;
              return doc.save();
            })
            .catch(() => {});
        }

        // Deliberate duplicate mutationId resend: replay the exact same request via the
        // lower-level httpChannel.sendMutation (mutate() always mints a fresh id, so a
        // real duplicate delivery must go through the transport-level API directly, per
        // integration.test.ts test "5.").
        if (Math.random() < 0.05) {
          const dupRequest: SyncMutateRequest = {
            collection: COLLECTION,
            data: {title: `dup-${Date.now()}`},
            mutationId: `load-dup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            operation: "create",
          };
          loadPromises.push(
            owner.httpChannel
              .sendMutation(dupRequest)
              .then(() => owner.httpChannel.sendMutation(dupRequest))
              .then(() => {
                duplicateCount += 1;
              })
              .catch(() => {})
          );
        }
      } else {
        // Delete.
        const idx = Math.floor(Math.random() * knownEntityIds.length);
        const target = knownEntityIds[idx];
        const owner = harnessClients[target.clientIndex];
        const startedAt = Date.now();
        const {mutationId} = owner.client.mutate({
          collection: COLLECTION,
          id: target.id,
          operation: "delete",
        });
        loadPromises.push(trackMutation(owner, mutationId, startedAt));
        knownEntityIds.splice(idx, 1);
      }

      // ── Fan-out lag sample: an out-of-band server write, measured against every
      // connected client's local store reflecting it ─────────────────────────────
      if (Math.random() < 0.02) {
        const anyOwner = randomClient();
        const writeStart = Date.now();
        const doc = await LoadTodoModel.create({
          ownerId: anyOwner.ownerId,
          title: `fanout-${writeStart}`,
        });
        const id = String(doc._id);
        knownEntityIds.push({clientIndex: harnessClients.indexOf(anyOwner), id});
        loadPromises.push(
          waitFor(
            () =>
              harnessClients.every(
                (hc2) => hc2.client.store.getEntity({collection: COLLECTION, id}) !== undefined
              ),
            {
              intervalMs: 8,
              label: `fanout delta for ${id}`,
              timeoutMs: 15_000,
            }
          )
            .then(() => {
              fanoutLagsMs.push(Date.now() - writeStart);
            })
            .catch(() => {})
        );
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    await Promise.all(loadPromises);

    // Resolve any conflicts left over from the deliberate server-race scenario the load
    // phase injects (useServer: the canonical server doc wins) — exactly what a real
    // client eventually does, either via user action or an auto-resolve policy. Without
    // this, a conflicted mutation sits in the outbox forever and both `queuedCount` and
    // the final convergence check would spuriously never settle.
    for (const hc of harnessClients) {
      for (const conflict of listConflicts({store: hc.client.store})) {
        hc.client.resolveConflict({mutationId: conflict.mutationId, strategy: "useServer"});
      }
    }

    // Drain any outstanding queued mutations before checking convergence.
    await waitFor(() => harnessClients.every((hc) => hc.client.getSyncStatus().queuedCount === 0), {
      label: "all clients drained",
      timeoutMs: 60_000,
    }).catch((error: unknown) => {
      logger.warn(`[loadHarness] drain wait: ${String(error)}`);
    });

    // ── Final-state convergence check ───────────────────────────────────────
    let convergenceFailures = 0;
    for (const hc of harnessClients) {
      const localEntities = new Map(
        hc.client.store
          .listEntities<{title?: string}>({collection: COLLECTION})
          .map((entity) => [entity.id, {data: entity.data, seq: entity.seq}])
      );
      const serverDocs = await LoadTodoModel.find({deleted: {$ne: true}, ownerId: hc.ownerId});
      const serverMap = new Map(
        serverDocs.map((doc) => [
          String(doc._id),
          {seq: (doc as unknown as {_syncSeq?: number})._syncSeq ?? 0, title: doc.title},
        ])
      );

      let matches = localEntities.size === serverMap.size;
      if (matches) {
        for (const [id, local] of localEntities) {
          const server = serverMap.get(id);
          const localData = local.data as {title?: string} | undefined;
          if (!server || server.seq !== local.seq || server.title !== localData?.title) {
            matches = false;
            break;
          }
        }
      }
      if (!matches) {
        convergenceFailures += 1;
      }
      logger.info(
        `[loadHarness] convergence ${matches ? "PASS" : "FAIL"} for ${hc.name} (local=${localEntities.size}, server=${serverMap.size})`
      );
    }

    // ── Report ───────────────────────────────────────────────────────────────
    const report = [
      "",
      "==================== SyncDB Load Harness Report ====================",
      `clients=${config.clients} seedDocs=${config.seedDocs} targetRate=${config.targetRate}/s durationSec=${config.durationSec}`,
      "",
      `Bootstrap wall time @ ${config.seedDocs} docs: ${bootstrapWallMs}ms`,
      "",
      "Mutate round-trip latency (ms):",
      `  p50=${percentile(mutateLatenciesMs, 50).toFixed(1)} p95=${percentile(mutateLatenciesMs, 95).toFixed(1)} p99=${percentile(mutateLatenciesMs, 99).toFixed(1)} (n=${mutateLatenciesMs.length})`,
      `  acked=${ackCount} conflicted=${conflictCount} failed=${nackCount} duplicateResends=${duplicateCount}`,
      "",
      "Change-stream -> sync:delta fan-out lag across all sockets (ms):",
      fanoutLagsMs.length > 0
        ? `  min=${Math.min(...fanoutLagsMs).toFixed(1)} p50=${percentile(fanoutLagsMs, 50).toFixed(1)} p95=${percentile(fanoutLagsMs, 95).toFixed(1)} max=${Math.max(...fanoutLagsMs).toFixed(1)} (n=${fanoutLagsMs.length})`
        : "  (no samples collected)",
      "",
      `Final-state convergence: ${harnessClients.length - convergenceFailures}/${harnessClients.length} clients PASS`,
      "======================================================================",
      "",
    ].join("\n");
    // Deliberately plain stdout output for a load report — not a structured log line.
    process.stdout.write(report);

    if (convergenceFailures > 0) {
      exitCode = 1;
    }
  } catch (error: unknown) {
    logger.error(`[loadHarness] fatal error: ${String(error)}`);
    exitCode = 1;
  } finally {
    for (const hc of harnessClients) {
      await hc.client.stop().catch(() => {});
    }
    realtimeApp.getIo()?.disconnectSockets(true);
    httpServer.closeAllConnections?.();
    await realtimeApp.close().catch(() => {});
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    clearSyncRegistry();
    await mongoose.disconnect();
  }

  process.exit(exitCode);
};

main().catch((error: unknown) => {
  logger.error(`[loadHarness] unhandled error: ${String(error)}`);
  process.exit(1);
});
