// biome-ignore-all lint/suspicious/noExplicitAny: test mocks use dynamic shapes for sockets, io, and documents
/**
 * Tests for the sync socket layer (Tasks 2.3–2.5):
 *   - socketHandlers.ts (sync:subscribe / sync:unsubscribe / sync:mutate, caps, rate limit)
 *   - changeStreamWatcher.ts sync:delta emission (mock change streams + real change
 *     streams gated on replica-set availability, following realtime.test.ts conventions)
 *
 * socketAuth.ts (legacy JWT validator chain + Better Auth session validator) has its own
 * dedicated test file: realtime/socketAuth.test.ts.
 */

import {afterEach, beforeAll, beforeEach, describe, expect, it} from "bun:test";
import mongoose, {model, Schema} from "mongoose";

import type {ModelRouterOptions} from "../api";
import {createdUpdatedPlugin, type IsDeleted, isDeletedPlugin} from "../plugins";
import {
  emitSyncDeltaForChange,
  startChangeStreamWatcher,
  stopChangeStreamWatcher,
} from "../realtime/changeStreamWatcher";
import {clearRealtimeRegistry, registerRealtime} from "../realtime/registry";
import {setupDb} from "../tests";
import {SyncCounter, SyncMutation} from "./models";
import {MAX_SYNC_MUTATIONS_PER_BATCH} from "./mutationHandler";
import {
  clearSyncRegistry,
  findSyncEntryByCollectionTag,
  registerSync,
  type SyncRegistryEntry,
} from "./registry";
import type {SyncAppOptions} from "./routes";
import {
  clearActiveSyncAppOptions,
  getActiveSyncAppOptions,
  installSyncSocketHandlers,
  MAX_SYNC_COLLECTION_SUBSCRIPTIONS,
  MAX_SYNC_MUTATIONS_PER_SECOND,
  type SyncSocketLike,
  setActiveSyncAppOptions,
  syncRoomForStream,
} from "./socketHandlers";
import {SyncApp} from "./syncApp";
import {syncPlugin} from "./syncSeqPlugin";
import type {SyncAck, SyncDelta, SyncNack} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Test models
// ─────────────────────────────────────────────────────────────────────────────

interface SockStuff extends IsDeleted {
  _id: string;
  name: string;
  ownerId: string;
  created: Date;
  _syncSeq?: number;
}

const sockStuffSchema = new Schema<SockStuff>({
  name: {description: "The name of the item", required: true, type: String},
  ownerId: {description: "The user who owns this item", type: String},
});
sockStuffSchema.plugin(isDeletedPlugin);
sockStuffSchema.plugin(createdUpdatedPlugin);
sockStuffSchema.plugin(syncPlugin);
const SockStuffModel = model<SockStuff>("SockStuff", sockStuffSchema);

interface SockProject extends IsDeleted {
  _id: string;
  title: string;
  orgId: string;
  _syncSeq?: number;
}

const sockProjectSchema = new Schema<SockProject>({
  orgId: {description: "The organization this project belongs to", type: String},
  title: {description: "The project title", required: true, type: String},
});
sockProjectSchema.plugin(isDeletedPlugin);
sockProjectSchema.plugin(createdUpdatedPlugin);
sockProjectSchema.plugin(syncPlugin);
const SockProjectModel = model<SockProject>("SockProject", sockProjectSchema);

interface SockNews extends IsDeleted {
  _id: string;
  headline: string;
  _syncSeq?: number;
}

const sockNewsSchema = new Schema<SockNews>({
  headline: {description: "The news headline", required: true, type: String},
});
sockNewsSchema.plugin(isDeletedPlugin);
sockNewsSchema.plugin(createdUpdatedPlugin);
sockNewsSchema.plugin(syncPlugin);
const SockNewsModel = model<SockNews>("SockNews", sockNewsSchema);

const permissiveOptions = {
  permissions: {
    create: [() => true],
    delete: [() => true],
    list: [() => true],
    read: [() => true],
    update: [() => true],
  },
} as unknown as ModelRouterOptions<any>;

const adminOnlyOptions = {
  permissions: {
    create: [(_m: string, user?: {admin?: boolean}) => user?.admin === true],
    delete: [(_m: string, user?: {admin?: boolean}) => user?.admin === true],
    list: [(_m: string, user?: {admin?: boolean}) => user?.admin === true],
    read: [(_m: string, user?: {admin?: boolean}) => user?.admin === true],
    update: [(_m: string, user?: {admin?: boolean}) => user?.admin === true],
  },
} as unknown as ModelRouterOptions<any>;

const ownerReadOptions = {
  permissions: {
    create: [() => true],
    delete: [() => true],
    list: [() => true],
    read: [
      (_m: string, user?: {admin?: boolean; id?: string}, obj?: {ownerId?: unknown}) =>
        user?.admin === true || (obj?.ownerId != null && String(obj.ownerId) === user?.id),
    ],
    update: [() => true],
  },
} as unknown as ModelRouterOptions<any>;

/**
 * A minimal fake Mongoose model satisfying registerSync's schema/collection checks, for
 * tests that need many registrations (each real registration requires a distinct
 * compiled model).
 */
const makeFakeSyncModel = (name: string): any => ({
  collection: {
    collectionName: name.toLowerCase(),
    createIndex: async () => {},
  },
  modelName: name,
  schema: {
    path: (p: string) => {
      if (p === "deleted") {
        return {instance: "Boolean"};
      }
      if (p === "_syncSeq") {
        return {instance: "Number"};
      }
      return undefined;
    },
  },
});

// The shared test database can be dropped by another test file mid-suite
// (configurationPlugin.test.ts drops it in an afterAll); rebuild the unique indexes the
// duplicate-mutation tests depend on.
beforeAll(async () => {
  await Promise.all([SyncCounter.ensureIndexes(), SyncMutation.ensureIndexes()]);
});

const registerAll = (): void => {
  clearSyncRegistry();
  registerSync({
    config: {scope: {type: "owner"}},
    model: SockStuffModel as any,
    options: permissiveOptions,
    routePath: "/sockStuff",
  });
  registerSync({
    config: {scope: {field: "orgId", type: "tenant"}},
    model: SockProjectModel as any,
    options: permissiveOptions,
    routePath: "/sockProjects",
  });
  registerSync({
    config: {scope: {type: "broadcast"}},
    model: SockNewsModel as any,
    options: permissiveOptions,
    routePath: "/sockNews",
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Mock socket (realtime.test.ts conventions)
// ─────────────────────────────────────────────────────────────────────────────

interface MockSocket extends SyncSocketLike {
  rooms: Set<string>;
  emitted: {event: string; payload: unknown}[];
  listeners: Map<string, (...args: any[]) => any>;
  trigger: (event: string, ...args: any[]) => Promise<void>;
}

const createMockSocket = (decodedToken?: {id?: string; admin?: boolean}): MockSocket => {
  const rooms = new Set<string>();
  const emitted: {event: string; payload: unknown}[] = [];
  const listeners = new Map<string, (...args: any[]) => any>();

  const socket: MockSocket = {
    decodedToken,
    emit: (event, payload) => {
      emitted.push({event, payload});
    },
    emitted,
    id: `socket-${Math.random().toString(36).slice(2, 9)}`,
    join: async (room: string) => {
      rooms.add(room);
    },
    leave: async (room: string) => {
      rooms.delete(room);
    },
    listeners,
    on: (event, handler) => {
      listeners.set(event, handler);
    },
    rooms,
    trigger: async (event, ...args) => {
      const handler = listeners.get(event);
      if (handler) {
        await handler(...args);
      }
    },
  };

  return socket;
};

const syncErrors = (socket: MockSocket): Array<{collection: string; message: string}> =>
  socket.emitted.filter((e) => e.event === "sync:error").map((e) => e.payload as any);

const install = (socket: MockSocket, options: SyncAppOptions = {}): void => {
  installSyncSocketHandlers(null, socket, options);
};

// ─────────────────────────────────────────────────────────────────────────────
// sync:subscribe / sync:unsubscribe
// ─────────────────────────────────────────────────────────────────────────────

describe("installSyncSocketHandlers — subscribe/unsubscribe", () => {
  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(() => {
    registerAll();
  });

  afterEach(() => {
    clearSyncRegistry();
  });

  it("owner scope joins the socket's own owner stream room", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    await socket.trigger("sync:subscribe", {collections: ["sockStuff"]});
    expect(socket.rooms.has("sync:sockStuff|owner:user1")).toBe(true);
    const subscribed = socket.emitted.find((e) => e.event === "sync:subscribed");
    expect(subscribed?.payload).toEqual({
      collection: "sockStuff",
      streams: ["sockStuff|owner:user1"],
    });
  });

  it("owner scope never uses a client-supplied user id", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    // The payload has no place for a user id — assert the room is keyed by the token id.
    await socket.trigger("sync:subscribe", {collections: ["sockStuff"], userId: "victim"} as any);
    expect(socket.rooms.has("sync:sockStuff|owner:user1")).toBe(true);
    expect(Array.from(socket.rooms).some((r) => r.includes("victim"))).toBe(false);
  });

  it("tenant scope joins one room per scope from getUserScopes", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket, {getUserScopes: () => ["org1", "org2"]});
    await socket.trigger("sync:subscribe", {collections: ["sockProjects"]});
    expect(socket.rooms.has("sync:sockProjects|tenant:org1")).toBe(true);
    expect(socket.rooms.has("sync:sockProjects|tenant:org2")).toBe(true);
  });

  it("tenant scope without a getUserScopes resolver emits sync:error", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket, {});
    await socket.trigger("sync:subscribe", {collections: ["sockProjects"]});
    expect(socket.rooms.size).toBe(0);
    expect(syncErrors(socket)).toHaveLength(1);
    expect(syncErrors(socket)[0].collection).toBe("sockProjects");
  });

  it("tenant scope emits sync:error when getUserScopes throws", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket, {
      getUserScopes: () => {
        throw new Error("membership lookup failed");
      },
    });
    await socket.trigger("sync:subscribe", {collections: ["sockProjects"]});
    expect(socket.rooms.size).toBe(0);
    expect(syncErrors(socket)).toHaveLength(1);
  });

  it("broadcast scope joins the shared all room", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    await socket.trigger("sync:subscribe", {collections: ["sockNews"]});
    expect(socket.rooms.has("sync:sockNews|all")).toBe(true);
  });

  it("custom scope resolves streams from getUserScopes values", async () => {
    registerSync({
      config: {
        scope: (doc: Record<string, unknown>) => String(doc.region),
        snapshotFilter: () => ({}),
      },
      model: makeFakeSyncModel("SockRegion"),
      options: permissiveOptions,
      routePath: "/sockRegions",
    });
    const socket = createMockSocket({id: "user1"});
    install(socket, {getUserScopes: () => ["us-east", "eu-west"]});
    await socket.trigger("sync:subscribe", {collections: ["sockRegions"]});
    expect(socket.rooms.has("sync:sockRegions|custom:us-east")).toBe(true);
    expect(socket.rooms.has("sync:sockRegions|custom:eu-west")).toBe(true);
  });

  it("unknown collection emits sync:error and skips, without affecting others", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    await socket.trigger("sync:subscribe", {collections: ["nope", "sockStuff"]});
    expect(syncErrors(socket)).toEqual([
      {collection: "nope", message: "Unknown sync collection: nope"},
    ]);
    expect(socket.rooms.has("sync:sockStuff|owner:user1")).toBe(true);
  });

  it("denies subscription when list permission fails", async () => {
    clearSyncRegistry();
    registerSync({
      config: {scope: {type: "owner"}},
      model: SockStuffModel as any,
      options: adminOnlyOptions,
      routePath: "/sockStuff",
    });
    const socket = createMockSocket({admin: false, id: "user1"});
    install(socket);
    await socket.trigger("sync:subscribe", {collections: ["sockStuff"]});
    expect(socket.rooms.size).toBe(0);
    expect(syncErrors(socket)).toHaveLength(1);
  });

  it("allows admin subscription when list permission requires admin", async () => {
    clearSyncRegistry();
    registerSync({
      config: {scope: {type: "owner"}},
      model: SockStuffModel as any,
      options: adminOnlyOptions,
      routePath: "/sockStuff",
    });
    const socket = createMockSocket({admin: true, id: "admin1"});
    install(socket);
    await socket.trigger("sync:subscribe", {collections: ["sockStuff"]});
    expect(socket.rooms.has("sync:sockStuff|owner:admin1")).toBe(true);
  });

  it("emits sync:error for unauthenticated sockets", async () => {
    const socket = createMockSocket(undefined);
    install(socket);
    await socket.trigger("sync:subscribe", {collections: ["sockStuff"]});
    expect(socket.rooms.size).toBe(0);
    expect(syncErrors(socket)[0].message).toBe("Authentication required");
  });

  it("ignores malformed payloads", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    await socket.trigger("sync:subscribe", null);
    await socket.trigger("sync:subscribe", {});
    await socket.trigger("sync:subscribe", {collections: "sockStuff"});
    await socket.trigger("sync:subscribe", {collections: [42, "", null]});
    expect(socket.rooms.size).toBe(0);
    expect(syncErrors(socket)).toHaveLength(0);
  });

  it("is idempotent for repeated subscriptions to the same collection", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    await socket.trigger("sync:subscribe", {collections: ["sockStuff"]});
    await socket.trigger("sync:subscribe", {collections: ["sockStuff"]});
    const subscribedEvents = socket.emitted.filter((e) => e.event === "sync:subscribed");
    expect(subscribedEvents).toHaveLength(1);
  });

  it("enforces the per-socket collection cap with sync:error", async () => {
    clearSyncRegistry();
    for (let i = 0; i < MAX_SYNC_COLLECTION_SUBSCRIPTIONS + 3; i++) {
      registerSync({
        config: {scope: {type: "broadcast"}},
        model: makeFakeSyncModel(`CapColl${i}`),
        options: permissiveOptions,
        routePath: `/capColl${i}`,
      });
    }
    const socket = createMockSocket({id: "user1"});
    install(socket);
    const collections = Array.from(
      {length: MAX_SYNC_COLLECTION_SUBSCRIPTIONS + 3},
      (_v, i) => `capColl${i}`
    );
    await socket.trigger("sync:subscribe", {collections});
    const syncRooms = Array.from(socket.rooms).filter((r) => r.startsWith("sync:"));
    expect(syncRooms).toHaveLength(MAX_SYNC_COLLECTION_SUBSCRIPTIONS);
    expect(syncErrors(socket)).toHaveLength(3);
  });

  it("sync:unsubscribe leaves the rooms and frees the cap slot", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket, {getUserScopes: () => ["org1", "org2"]});
    await socket.trigger("sync:subscribe", {collections: ["sockStuff", "sockProjects"]});
    expect(socket.rooms.has("sync:sockStuff|owner:user1")).toBe(true);
    expect(socket.rooms.has("sync:sockProjects|tenant:org1")).toBe(true);

    await socket.trigger("sync:unsubscribe", {collections: ["sockProjects"]});
    expect(socket.rooms.has("sync:sockProjects|tenant:org1")).toBe(false);
    expect(socket.rooms.has("sync:sockProjects|tenant:org2")).toBe(false);
    expect(socket.rooms.has("sync:sockStuff|owner:user1")).toBe(true);

    // Re-subscribing after unsubscribe emits a fresh sync:subscribed.
    await socket.trigger("sync:subscribe", {collections: ["sockProjects"]});
    const subscribedEvents = socket.emitted.filter(
      (e) => e.event === "sync:subscribed" && (e.payload as any).collection === "sockProjects"
    );
    expect(subscribedEvents).toHaveLength(2);
  });

  it("sync:unsubscribe ignores malformed payloads and unknown collections", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    await socket.trigger("sync:unsubscribe", null);
    await socket.trigger("sync:unsubscribe", {collections: ["neverSubscribed", 42]});
    expect(socket.rooms.size).toBe(0);
  });

  it("disconnect clears tracked subscriptions", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    await socket.trigger("sync:subscribe", {collections: ["sockStuff"]});
    await socket.trigger("disconnect");
    // Rooms are cleaned by Socket.io itself on disconnect; the tracking map is cleared, so
    // a re-subscribe emits sync:subscribed again instead of being treated as a duplicate.
    await socket.trigger("sync:subscribe", {collections: ["sockStuff"]});
    const subscribedEvents = socket.emitted.filter((e) => e.event === "sync:subscribed");
    expect(subscribedEvents).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// sync:mutate
// ─────────────────────────────────────────────────────────────────────────────

describe("installSyncSocketHandlers — sync:mutate", () => {
  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(async () => {
    registerAll();
    await Promise.all([
      SockStuffModel.collection.deleteMany({}),
      SyncCounter.deleteMany({}),
      SyncMutation.deleteMany({}),
    ]);
  });

  afterEach(() => {
    clearSyncRegistry();
  });

  const lastAck = (socket: MockSocket): SyncAck | undefined => {
    const acks = socket.emitted.filter((e) => e.event === "sync:ack");
    return acks[acks.length - 1]?.payload as SyncAck | undefined;
  };

  const lastNack = (socket: MockSocket): SyncNack | undefined => {
    const nacks = socket.emitted.filter((e) => e.event === "sync:nack");
    return nacks[nacks.length - 1]?.payload as SyncNack | undefined;
  };

  it("applies a create mutation and emits sync:ack", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    await socket.trigger("sync:mutate", {
      collection: "sockStuff",
      data: {name: "created over socket", ownerId: "user1"},
      mutationId: "sock-mut-1",
      operation: "create",
    });
    const ack = lastAck(socket);
    expect(ack?.mutationId).toBe("sock-mut-1");
    expect(ack?.seq).toBe(1);
    const doc = await SockStuffModel.findById(ack?.id);
    expect(doc?.name).toBe("created over socket");
  });

  it("invokes the Socket.io ack callback with the outcome", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    const replies: unknown[] = [];
    await socket.trigger(
      "sync:mutate",
      {
        collection: "sockStuff",
        data: {name: "cb", ownerId: "user1"},
        mutationId: "sock-mut-cb",
        operation: "create",
      },
      (response: unknown) => replies.push(response)
    );
    expect(replies).toHaveLength(1);
    expect((replies[0] as {ack: SyncAck}).ack.mutationId).toBe("sock-mut-cb");
  });

  it("stale baseVersion emits sync:nack conflict carrying the server doc", async () => {
    const doc = await SockStuffModel.create({name: "v1", ownerId: "user1"});
    await SockStuffModel.findOneAndUpdate({_id: doc._id}, {$set: {name: "v2"}});

    const socket = createMockSocket({id: "user1"});
    install(socket);
    await socket.trigger("sync:mutate", {
      baseVersion: 1,
      collection: "sockStuff",
      data: {name: "stale write"},
      id: String(doc._id),
      mutationId: "sock-mut-conflict",
      operation: "update",
    });
    const nack = lastNack(socket);
    expect(nack?.code).toBe("conflict");
    expect(nack?.serverSeq).toBe(2);
    expect((nack?.serverDoc as any)?.name).toBe("v2");
  });

  it("duplicate mutationId over the socket returns the recorded outcome without re-applying", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    const mutation = {
      collection: "sockStuff",
      data: {name: "dup", ownerId: "user1"},
      mutationId: "sock-mut-dup",
      operation: "create",
    };
    await socket.trigger("sync:mutate", mutation);
    await socket.trigger("sync:mutate", mutation);
    const acks = socket.emitted.filter((e) => e.event === "sync:ack");
    expect(acks).toHaveLength(2);
    expect((acks[0].payload as SyncAck).id).toBe((acks[1].payload as SyncAck).id);
    expect((acks[0].payload as SyncAck).seq).toBe((acks[1].payload as SyncAck).seq);
    expect(await SockStuffModel.countDocuments({name: "dup"})).toBe(1);
  });

  it("nacks validation for an unknown collection", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    await socket.trigger("sync:mutate", {
      collection: "nope",
      data: {},
      mutationId: "sock-mut-unknown",
      operation: "create",
    });
    expect(lastNack(socket)?.code).toBe("validation");
  });

  it("nacks unauthorized for unauthenticated sockets", async () => {
    const socket = createMockSocket(undefined);
    install(socket);
    await socket.trigger("sync:mutate", {
      collection: "sockStuff",
      data: {name: "x"},
      mutationId: "sock-mut-anon",
      operation: "create",
    });
    expect(lastNack(socket)?.code).toBe("unauthorized");
  });

  it("rate-limits mutations beyond the per-second cap with a rate_limited nack carrying retryAfterMs (FIX 1)", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    // Exceed the window with cheap validation nacks (unknown collection) — the rate limit
    // triggers before the mutation is applied, so these never hit the database.
    for (let i = 0; i < MAX_SYNC_MUTATIONS_PER_SECOND + 5; i++) {
      await socket.trigger("sync:mutate", {
        collection: "nope",
        mutationId: `flood-${i}`,
        operation: "create",
      });
    }
    const nacks = socket.emitted.filter((e) => e.event === "sync:nack");
    expect(nacks).toHaveLength(MAX_SYNC_MUTATIONS_PER_SECOND + 5);
    const rateLimited = nacks.filter((e) =>
      (e.payload as SyncNack).message?.includes("Rate limit")
    );
    expect(rateLimited).toHaveLength(5);
    // FIX 1: the nack code is "rate_limited" (never "error") so the client
    // never treats it as a durable-data failure, and it carries a
    // retryAfterMs hint for the client's backoff floor.
    for (const nack of rateLimited) {
      const payload = nack.payload as SyncNack;
      expect(payload.code).toBe("rate_limited");
      expect(typeof (payload as {retryAfterMs?: number}).retryAfterMs).toBe("number");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// sync:mutateBatch
// ─────────────────────────────────────────────────────────────────────────────

describe("installSyncSocketHandlers — sync:mutateBatch", () => {
  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(async () => {
    registerAll();
    await Promise.all([
      SockStuffModel.collection.deleteMany({}),
      SyncCounter.deleteMany({}),
      SyncMutation.deleteMany({}),
    ]);
  });

  afterEach(() => {
    clearSyncRegistry();
  });

  const create = (mutationId: string, name: string) => ({
    collection: "sockStuff",
    data: {name, ownerId: "user1"},
    mutationId,
    operation: "create",
  });

  const triggerBatch = async (
    socket: MockSocket,
    mutations: unknown[]
  ): Promise<{results: Array<{type: string; ack?: SyncAck; nack?: SyncNack}>}> => {
    let response: any;
    await socket.trigger("sync:mutateBatch", {mutations}, (res: unknown) => {
      response = res;
    });
    return response;
  };

  it("applies a batch strictly in order via the ack callback", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    const mutations = Array.from({length: 5}, (_v, i) => create(`sock-batch-${i}`, `item ${i}`));
    const response = await triggerBatch(socket, mutations);
    expect(response.results).toHaveLength(5);
    expect(response.results.every((r) => r.type === "ack")).toBe(true);
    const seqs = response.results.map((r) => r.ack?.seq);
    expect(seqs).toEqual([1, 2, 3, 4, 5]);
  });

  it("stops at the first nack, leaving later mutations unattempted", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    const mutations = [
      create("sock-batch-halt-1", "ok"),
      {collection: "nope", mutationId: "sock-batch-halt-2", operation: "create"},
      create("sock-batch-halt-3", "never"),
    ];
    const response = await triggerBatch(socket, mutations);
    expect(response.results).toHaveLength(2);
    expect(response.results[0].type).toBe("ack");
    expect(response.results[1].type).toBe("nack");
    expect(response.results[1].nack?.code).toBe("validation");
    expect(await SockStuffModel.countDocuments({name: "never"})).toBe(0);
  });

  it("rejects an oversized batch before processing", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    const mutations = Array.from({length: MAX_SYNC_MUTATIONS_PER_BATCH + 1}, (_v, i) =>
      create(`sock-batch-oversized-${i}`, `item ${i}`)
    );
    const response = await triggerBatch(socket, mutations);
    expect(response.results).toHaveLength(1);
    expect(response.results[0].nack?.code).toBe("validation");
    expect(await SockStuffModel.countDocuments({})).toBe(0);
  });

  it("rejects intra-batch duplicate mutationIds before processing", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    const mutations = [create("sock-batch-dup", "a"), create("sock-batch-dup", "b")];
    const response = await triggerBatch(socket, mutations);
    expect(response.results).toHaveLength(1);
    expect(response.results[0].nack?.code).toBe("validation");
    expect(await SockStuffModel.countDocuments({})).toBe(0);
  });

  it("nacks unauthorized for unauthenticated sockets", async () => {
    const socket = createMockSocket(undefined);
    install(socket);
    const response = await triggerBatch(socket, [create("sock-batch-anon", "x")]);
    expect(response.results).toHaveLength(1);
    expect(response.results[0].nack?.code).toBe("unauthorized");
  });

  it("rate-limits batch mutations against the same window as sync:mutate with a rate_limited nack carrying retryAfterMs (FIX 1)", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    // Two batches within the per-batch size cap, but together exceeding the
    // per-second mutation budget — the shared window rejects the second batch
    // before any of its mutations are attempted.
    const firstBatch = Array.from({length: MAX_SYNC_MUTATIONS_PER_BATCH}, (_v, i) => ({
      collection: "nope",
      mutationId: `flood-batch-a-${i}`,
      operation: "create",
    }));
    const secondBatch = Array.from({length: 10}, (_v, i) => ({
      collection: "nope",
      mutationId: `flood-batch-b-${i}`,
      operation: "create",
    }));
    await triggerBatch(socket, firstBatch);
    const response = await triggerBatch(socket, secondBatch);
    expect(response.results).toHaveLength(1);
    expect(response.results[0].nack?.message).toContain("Rate limit");
    // FIX 1: rate limiting must never look like a durable-data error — the
    // client treats "rate_limited" like a transport failure (never terminal).
    expect(response.results[0].nack?.code).toBe("rate_limited");
    expect(typeof (response.results[0].nack as {retryAfterMs?: number})?.retryAfterMs).toBe(
      "number"
    );
  });

  it("emits sync:batchReceived immediately, before any mutation is applied (FIX 5)", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    const mutations = [create("sock-batch-receipt-1", "a")];
    await socket.trigger("sync:mutateBatch", {batchId: "b-123", mutations}, () => {});
    const receipts = socket.emitted.filter((e) => e.event === "sync:batchReceived");
    expect(receipts).toHaveLength(1);
    expect(receipts[0].payload).toEqual({batchId: "b-123"});
  });

  it("does not emit sync:batchReceived when the request has no batchId (HTTP-shaped payload)", async () => {
    const socket = createMockSocket({id: "user1"});
    install(socket);
    await triggerBatch(socket, [create("sock-batch-no-id", "a")]);
    expect(socket.emitted.filter((e) => e.event === "sync:batchReceived")).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Active SyncAppOptions wiring (SyncApp -> RealtimeApp)
// ─────────────────────────────────────────────────────────────────────────────

describe("active SyncAppOptions", () => {
  afterEach(() => {
    clearActiveSyncAppOptions();
  });

  it("SyncApp.register publishes its options for the socket layer", async () => {
    const express = (await import("express")).default;
    const app = express();
    const options: SyncAppOptions = {getUserScopes: () => ["orgX"]};
    new SyncApp(options).register(app);
    expect(getActiveSyncAppOptions()).toBe(options);
  });

  it("set/get/clear round-trips", () => {
    const options: SyncAppOptions = {};
    setActiveSyncAppOptions(options);
    expect(getActiveSyncAppOptions()).toBe(options);
    clearActiveSyncAppOptions();
    expect(getActiveSyncAppOptions()).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// sync:delta emission — mock io helpers
// ─────────────────────────────────────────────────────────────────────────────

const makeTrackedIo = (): any => {
  const emissions: Array<{event: string; payload: any; room: string; socketId: string}> = [];
  const rooms = new Map<string, Set<string>>();
  const sockets = new Map<string, any>();

  const addSocketToRoom = (
    room: string,
    decodedToken: {id?: string; admin?: boolean} = {admin: true, id: "admin"}
  ): void => {
    const socketId = `socket-${Math.random().toString(36).slice(2, 9)}`;
    if (!rooms.has(room)) {
      rooms.set(room, new Set());
    }
    rooms.get(room)?.add(socketId);
    sockets.set(socketId, {
      decodedToken,
      emit: (event: string, payload: unknown): void => {
        emissions.push({event, payload, room, socketId});
      },
      id: socketId,
    });
  };

  return {
    addSocketToRoom,
    emissions,
    sockets: {
      adapter: {rooms},
      sockets,
    },
    to: (room: string) => ({
      emit: (event: string, payload: unknown): void => {
        emissions.push({event, payload, room, socketId: "broadcast"});
      },
    }),
  };
};

const makeChange = (overrides: Record<string, unknown>): any => ({
  documentKey: {_id: "doc-1"},
  ns: {coll: "sockstuffs"},
  operationType: "insert",
  ...overrides,
});

// ─────────────────────────────────────────────────────────────────────────────
// emitSyncDeltaForChange — unit tests with synthetic changes
// ─────────────────────────────────────────────────────────────────────────────

describe("emitSyncDeltaForChange", () => {
  beforeAll(async () => {
    await setupDb();
  });

  beforeEach(() => {
    registerAll();
  });

  afterEach(() => {
    clearSyncRegistry();
  });

  const ownerEntry = (): SyncRegistryEntry => {
    clearSyncRegistry();
    registerSync({
      config: {scope: {type: "owner"}},
      model: SockStuffModel as any,
      options: ownerReadOptions,
      routePath: "/sockStuff",
    });
    return findSyncEntryByCollectionTag("sockStuff") as SyncRegistryEntry;
  };

  it("emits a create delta with seq and stream to the owner stream room", async () => {
    const entry = ownerEntry();
    const io = makeTrackedIo();
    io.addSocketToRoom(syncRoomForStream("sockStuff|owner:user1"), {admin: false, id: "user1"});

    await emitSyncDeltaForChange({
      change: makeChange({
        fullDocument: {_id: "doc-1", _syncSeq: 7, name: "hello", ownerId: "user1"},
        operationType: "insert",
      }),
      docId: "doc-1",
      entry,
      io,
      logDebug: () => {},
    });

    const deltas = io.emissions.filter((e: any) => e.event === "sync:delta");
    expect(deltas).toHaveLength(1);
    const delta = deltas[0].payload as SyncDelta;
    expect(delta.method).toBe("create");
    expect(delta.seq).toBe(7);
    expect(delta.stream).toBe("sockStuff|owner:user1");
    expect(delta.collection).toBe("sockStuff");
    expect((delta.data as any).name).toBe("hello");
    expect((delta.data as any).id).toBe("doc-1");
  });

  it("does not emit to sockets whose read permission fails (owner isolation)", async () => {
    const entry = ownerEntry();
    const io = makeTrackedIo();
    const room = syncRoomForStream("sockStuff|owner:user1");
    io.addSocketToRoom(room, {admin: false, id: "user1"});
    io.addSocketToRoom(room, {admin: false, id: "intruder"});

    await emitSyncDeltaForChange({
      change: makeChange({
        fullDocument: {_id: "doc-1", _syncSeq: 1, name: "secret", ownerId: "user1"},
      }),
      docId: "doc-1",
      entry,
      io,
      logDebug: () => {},
    });

    const deltas = io.emissions.filter((e: any) => e.event === "sync:delta");
    expect(deltas).toHaveLength(1);
    const receiver = io.sockets.sockets.get(deltas[0].socketId);
    expect(receiver.decodedToken.id).toBe("user1");
  });

  it("soft delete emits a delete delta with deleted true and tombstone data", async () => {
    const entry = ownerEntry();
    const io = makeTrackedIo();
    io.addSocketToRoom(syncRoomForStream("sockStuff|owner:user1"), {admin: false, id: "user1"});

    await emitSyncDeltaForChange({
      change: makeChange({
        fullDocument: {_id: "doc-1", _syncSeq: 3, deleted: true, name: "gone", ownerId: "user1"},
        operationType: "update",
        updateDescription: {updatedFields: {deleted: true}},
      }),
      docId: "doc-1",
      entry,
      io,
      logDebug: () => {},
    });

    const deltas = io.emissions.filter((e: any) => e.event === "sync:delta");
    expect(deltas).toHaveLength(1);
    const delta = deltas[0].payload as SyncDelta;
    expect(delta.method).toBe("delete");
    expect(delta.deleted).toBe(true);
    expect(delta.seq).toBe(3);
    expect((delta.data as any).name).toBe("gone");
  });

  it("scope move emits a data-less tombstone to the previous stream and a create to the new stream", async () => {
    const entry = ownerEntry();
    const io = makeTrackedIo();
    const oldRoom = syncRoomForStream("sockStuff|owner:user1");
    const newRoom = syncRoomForStream("sockStuff|owner:user2");
    io.addSocketToRoom(oldRoom, {admin: true, id: "admin"});
    io.addSocketToRoom(newRoom, {admin: true, id: "admin"});

    await emitSyncDeltaForChange({
      change: makeChange({
        fullDocument: {
          _id: "doc-1",
          _syncPrevStream: "sockStuff|owner:user1",
          _syncSeq: 9,
          name: "moved",
          ownerId: "user2",
        },
        operationType: "update",
        updateDescription: {updatedFields: {ownerId: "user2"}},
      }),
      docId: "doc-1",
      entry,
      io,
      logDebug: () => {},
    });

    const deltas = io.emissions.filter((e: any) => e.event === "sync:delta");
    expect(deltas).toHaveLength(2);

    const tombstone = deltas.find((e: any) => e.room === oldRoom)?.payload as SyncDelta;
    expect(tombstone.method).toBe("delete");
    expect(tombstone.deleted).toBe(true);
    expect(tombstone.stream).toBe("sockStuff|owner:user1");
    expect(tombstone.seq).toBe(9);
    expect(tombstone.data).toBeUndefined();

    const create = deltas.find((e: any) => e.room === newRoom)?.payload as SyncDelta;
    expect(create.method).toBe("create");
    expect(create.stream).toBe("sockStuff|owner:user2");
    expect((create.data as any).name).toBe("moved");
  });

  it("ignores a stale _syncPrevStream equal to the current stream", async () => {
    const entry = ownerEntry();
    const io = makeTrackedIo();
    io.addSocketToRoom(syncRoomForStream("sockStuff|owner:user1"), {admin: false, id: "user1"});

    await emitSyncDeltaForChange({
      change: makeChange({
        fullDocument: {
          _id: "doc-1",
          _syncPrevStream: "sockStuff|owner:user1",
          _syncSeq: 4,
          name: "same stream",
          ownerId: "user1",
        },
        operationType: "update",
        updateDescription: {updatedFields: {name: "same stream"}},
      }),
      docId: "doc-1",
      entry,
      io,
      logDebug: () => {},
    });

    const deltas = io.emissions.filter((e: any) => e.event === "sync:delta");
    expect(deltas).toHaveLength(1);
    expect((deltas[0].payload as SyncDelta).method).toBe("update");
  });

  it("skips hard deletes (no post-image)", async () => {
    const entry = ownerEntry();
    const io = makeTrackedIo();
    io.addSocketToRoom(syncRoomForStream("sockStuff|owner:user1"), {admin: false, id: "user1"});

    await emitSyncDeltaForChange({
      change: makeChange({operationType: "delete"}),
      docId: "doc-1",
      entry,
      io,
      logDebug: () => {},
    });

    expect(io.emissions.filter((e: any) => e.event === "sync:delta")).toHaveLength(0);
  });

  it("applies the sync responseHandler to delta data", async () => {
    clearSyncRegistry();
    registerSync({
      config: {
        responseHandler: (doc: Record<string, unknown>) => ({onlyName: doc.name}),
        scope: {type: "owner"},
      },
      model: SockStuffModel as any,
      options: permissiveOptions,
      routePath: "/sockStuff",
    });
    const entry = findSyncEntryByCollectionTag("sockStuff") as SyncRegistryEntry;
    const io = makeTrackedIo();
    io.addSocketToRoom(syncRoomForStream("sockStuff|owner:user1"), {admin: false, id: "user1"});

    await emitSyncDeltaForChange({
      change: makeChange({
        fullDocument: {_id: "doc-1", _syncSeq: 1, name: "shaped", ownerId: "user1", secret: "x"},
      }),
      docId: "doc-1",
      entry,
      io,
      logDebug: () => {},
    });

    const delta = io.emissions.find((e: any) => e.event === "sync:delta")?.payload as SyncDelta;
    expect(delta.data).toEqual({onlyName: "shaped"});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// sync:delta — change stream integration (requires a replica set, like
// realtime.test.ts's change event integration block)
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

/**
 * Start the watcher and give the change-stream cursor a moment to open so writes made
 * immediately afterwards are not missed (change streams only deliver post-open events).
 */
const startWatcherAndSettle = async (io: any): Promise<void> => {
  startChangeStreamWatcher(io, {}, true);
  await new Promise((resolve) => setTimeout(resolve, 300));
};

const waitForDelta = async (
  io: any,
  predicate: (delta: SyncDelta, emission: any) => boolean,
  timeoutMs = 5000
): Promise<void> => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const match = io.emissions.some(
      (e: any) => e.event === "sync:delta" && predicate(e.payload as SyncDelta, e)
    );
    if (match) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

describe("sync:delta — change stream integration", () => {
  let replicaSetAvailable = false;

  beforeAll(async () => {
    await setupDb();
    replicaSetAvailable = await hasReplicaSet();
  });

  beforeEach(async () => {
    clearRealtimeRegistry();
    registerAll();
    await Promise.all([
      SockStuffModel.collection.deleteMany({}),
      SockProjectModel.collection.deleteMany({}),
      SyncCounter.deleteMany({}),
    ]);
  });

  afterEach(async () => {
    await stopChangeStreamWatcher();
    clearRealtimeRegistry();
    clearSyncRegistry();
  });

  it("create, update, and soft delete each produce exactly one delta with correct seq and stream", async () => {
    if (!replicaSetAvailable) {
      return;
    }
    const io = makeTrackedIo();
    io.addSocketToRoom(syncRoomForStream("sockStuff|owner:cs-user"), {admin: false, id: "cs-user"});
    await startWatcherAndSettle(io);

    const doc = await SockStuffModel.create({name: "cs-create", ownerId: "cs-user"});
    const docId = String(doc._id);
    await waitForDelta(io, (d) => d.id === docId && d.method === "create");

    doc.name = "cs-updated";
    await doc.save();
    await waitForDelta(io, (d) => d.id === docId && d.method === "update");

    doc.deleted = true;
    await doc.save();
    await waitForDelta(io, (d) => d.id === docId && d.method === "delete");

    const deltas = io.emissions
      .filter((e: any) => e.event === "sync:delta")
      .map((e: any) => e.payload as SyncDelta);

    const creates = deltas.filter((d) => d.method === "create");
    const updates = deltas.filter((d) => d.method === "update");
    const deletes = deltas.filter((d) => d.method === "delete");
    expect(creates).toHaveLength(1);
    expect(updates).toHaveLength(1);
    expect(deletes).toHaveLength(1);

    expect(creates[0].seq).toBe(1);
    expect(updates[0].seq).toBe(2);
    expect(deletes[0].seq).toBe(3);
    for (const delta of deltas) {
      expect(delta.stream).toBe("sockStuff|owner:cs-user");
      expect(delta.collection).toBe("sockStuff");
    }
    expect(deletes[0].deleted).toBe(true);
    expect((deletes[0].data as any).name).toBe("cs-updated");
  });

  it("a socket subscribed to tenant org1 never receives org2's delta", async () => {
    if (!replicaSetAvailable) {
      return;
    }
    const io = makeTrackedIo();
    io.addSocketToRoom(syncRoomForStream("sockProjects|tenant:org1"), {admin: false, id: "u1"});
    await startWatcherAndSettle(io);

    const org1Doc = await SockProjectModel.create({orgId: "org1", title: "org1 project"});
    const org2Doc = await SockProjectModel.create({orgId: "org2", title: "org2 project"});
    await waitForDelta(io, (d) => d.id === String(org1Doc._id));
    // Give the org2 event a chance to (incorrectly) arrive too.
    await new Promise((resolve) => setTimeout(resolve, 500));

    const deltas = io.emissions
      .filter((e: any) => e.event === "sync:delta")
      .map((e: any) => e.payload as SyncDelta);
    expect(deltas.some((d) => d.id === String(org1Doc._id))).toBe(true);
    expect(deltas.some((d) => d.id === String(org2Doc._id))).toBe(false);
    expect(deltas.every((d) => d.stream === "sockProjects|tenant:org1")).toBe(true);
  });

  it("scope move emits a tombstone to the old stream and a create to the new stream", async () => {
    if (!replicaSetAvailable) {
      return;
    }
    const io = makeTrackedIo();
    const oldRoom = syncRoomForStream("sockProjects|tenant:org1");
    const newRoom = syncRoomForStream("sockProjects|tenant:org2");
    io.addSocketToRoom(oldRoom, {admin: true, id: "admin"});
    io.addSocketToRoom(newRoom, {admin: true, id: "admin"});

    const doc = await SockProjectModel.create({orgId: "org1", title: "moving project"});
    const docId = String(doc._id);

    await startWatcherAndSettle(io);

    await SockProjectModel.findOneAndUpdate({_id: doc._id}, {$set: {orgId: "org2"}});
    await waitForDelta(io, (d, e) => d.id === docId && e.room === newRoom);
    await waitForDelta(io, (d, e) => d.id === docId && e.room === oldRoom);

    const deltas = io.emissions.filter(
      (e: any) => e.event === "sync:delta" && (e.payload as SyncDelta).id === docId
    );
    const tombstones = deltas.filter((e: any) => e.room === oldRoom);
    const creates = deltas.filter((e: any) => e.room === newRoom);
    expect(tombstones).toHaveLength(1);
    expect(creates).toHaveLength(1);

    const tombstone = tombstones[0].payload as SyncDelta;
    expect(tombstone.method).toBe("delete");
    expect(tombstone.deleted).toBe(true);
    expect(tombstone.stream).toBe("sockProjects|tenant:org1");
    expect(tombstone.data).toBeUndefined();

    const create = creates[0].payload as SyncDelta;
    expect(create.method).toBe("create");
    expect(create.stream).toBe("sockProjects|tenant:org2");
    expect((create.data as any).orgId).toBe("org2");
  });

  it("a model with both realtime and sync configs emits both event types", async () => {
    if (!replicaSetAvailable) {
      return;
    }
    registerRealtime({
      collectionName: SockStuffModel.collection.collectionName,
      config: {methods: ["create", "update", "delete"], roomStrategy: "model"},
      modelName: "SockStuff",
      options: permissiveOptions,
      routePath: "/sockStuff",
    });

    const io = makeTrackedIo();
    io.addSocketToRoom("model:sockStuff", {admin: true, id: "admin"});
    io.addSocketToRoom(syncRoomForStream("sockStuff|owner:both-user"), {
      admin: false,
      id: "both-user",
    });
    await startWatcherAndSettle(io);

    const doc = await SockStuffModel.create({name: "both", ownerId: "both-user"});
    const docId = String(doc._id);
    await waitForDelta(io, (d) => d.id === docId);

    const legacy = io.emissions.filter(
      (e: any) => e.event === "sync" && e.payload?.id === docId && e.payload?.method === "create"
    );
    const deltas = io.emissions.filter(
      (e: any) => e.event === "sync:delta" && (e.payload as SyncDelta).id === docId
    );
    expect(legacy.length).toBeGreaterThanOrEqual(1);
    expect(deltas).toHaveLength(1);
    expect((deltas[0].payload as SyncDelta).seq).toBe(1);
  });

  it("a sync-only model emits deltas even without a realtime registry entry", async () => {
    if (!replicaSetAvailable) {
      return;
    }
    const io = makeTrackedIo();
    io.addSocketToRoom(syncRoomForStream("sockStuff|owner:only-user"), {
      admin: false,
      id: "only-user",
    });
    await startWatcherAndSettle(io);

    const doc = await SockStuffModel.create({name: "sync only", ownerId: "only-user"});
    await waitForDelta(io, (d) => d.id === String(doc._id));

    const deltas = io.emissions.filter((e: any) => e.event === "sync:delta");
    expect(deltas).toHaveLength(1);
    expect(io.emissions.filter((e: any) => e.event === "sync")).toHaveLength(0);
  });
});
