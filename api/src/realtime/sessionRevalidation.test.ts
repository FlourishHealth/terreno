// biome-ignore-all lint/suspicious/noExplicitAny: test mocks use dynamic shapes for sockets, io, and models
/**
 * D1: socket session re-validation sweep.
 *   - revalidateSocketSession: expired/disabled/invalid-session detection per auth kind
 *   - reresolveSyncRoomsForSocket: D4 room membership diffing (leave revoked, join granted)
 *   - runSessionRevalidationSweep: disconnects failing sockets with sync:auth-expired
 *   - loadFullUserForSocket: D2 handshake full-user load
 */
import {afterEach, describe, expect, it, mock} from "bun:test";
import {DateTime} from "luxon";
import mongoose, {model, Schema} from "mongoose";

import {createdUpdatedPlugin, isDeletedPlugin} from "../plugins";
import {clearSyncRegistry, registerSync} from "../sync/registry";
import {syncPlugin} from "../sync/syncSeqPlugin";
import {
  loadFullUserForSocket,
  type RevalidatableSocket,
  reresolveSyncRoomsForSocket,
  revalidateSocketSession,
  runSessionRevalidationSweep,
  startSessionRevalidationSweep,
} from "./sessionRevalidation";

/** Minimal fake Mongoose model: findOneOrNoneFor falls back to `.find()` without the plugin. */
const fakeUserModel = (users: Record<string, unknown>): any => ({
  find: async (query: {_id: string}) => {
    const user = users[query._id];
    return user ? [user] : [];
  },
});

/**
 * Real (but never persisted — no test DB round-trip needed) Mongoose models satisfying
 * `registerSync`'s schema contract (soft delete + syncPlugin + scope field present), so
 * D4's room-resolution tests can register genuine sync registry entries.
 */
const revalTenantSchema = new Schema({
  organizationId: {type: String},
  title: {type: String},
});
revalTenantSchema.plugin(isDeletedPlugin);
revalTenantSchema.plugin(createdUpdatedPlugin);
revalTenantSchema.plugin(syncPlugin);
const RevalTenantModel =
  (mongoose.models.RevalSessionProject as mongoose.Model<any>) ||
  model("RevalSessionProject", revalTenantSchema);

const revalOwnerSchema = new Schema({
  ownerId: {type: String},
  title: {type: String},
});
revalOwnerSchema.plugin(isDeletedPlugin);
revalOwnerSchema.plugin(createdUpdatedPlugin);
revalOwnerSchema.plugin(syncPlugin);
const RevalOwnerModel =
  (mongoose.models.RevalSessionTodo as mongoose.Model<any>) ||
  model("RevalSessionTodo", revalOwnerSchema);

const makeSocket = (overrides: Partial<RevalidatableSocket> = {}): RevalidatableSocket => ({
  data: {},
  disconnect: mock(() => {}),
  emit: mock(() => {}),
  id: "socket-1",
  join: mock(async () => {}),
  leave: mock(async () => {}),
  ...overrides,
});

describe("revalidateSocketSession", () => {
  it("returns valid for a JWT socket whose exp is in the future", async () => {
    const socket = makeSocket({
      decodedToken: {
        authKind: "jwt",
        exp: DateTime.now().plus({minutes: 10}).toSeconds(),
        id: "u1",
      },
    });
    const outcome = await revalidateSocketSession(socket, {});
    expect(outcome).toBe("valid");
  });

  it("returns expired for a JWT socket whose exp has passed", async () => {
    const socket = makeSocket({
      decodedToken: {
        authKind: "jwt",
        exp: DateTime.now().minus({minutes: 1}).toSeconds(),
        id: "u1",
      },
    });
    const outcome = await revalidateSocketSession(socket, {});
    expect(outcome).toBe("expired");
  });

  it("treats a JWT socket with no exp claim as valid (nothing to check locally)", async () => {
    const socket = makeSocket({decodedToken: {authKind: "jwt", id: "u1"}});
    const outcome = await revalidateSocketSession(socket, {});
    expect(outcome).toBe("valid");
  });

  it("returns valid for a Better Auth socket whose session lookup still resolves", async () => {
    const socket = makeSocket({
      decodedToken: {authKind: "better-auth", id: "u1"},
      encodedToken: "session-token",
    });
    const outcome = await revalidateSocketSession(socket, {
      betterAuth: {
        auth: {api: {getSession: async () => ({user: {id: "u1"}})}} as any,
      },
    });
    expect(outcome).toBe("valid");
  });

  it("returns invalid-session for a Better Auth socket whose session no longer resolves", async () => {
    const socket = makeSocket({
      decodedToken: {authKind: "better-auth", id: "u1"},
      encodedToken: "revoked-session-token",
    });
    const outcome = await revalidateSocketSession(socket, {
      betterAuth: {auth: {api: {getSession: async () => null}} as any},
    });
    expect(outcome).toBe("invalid-session");
  });

  it("returns invalid-session for a Better Auth socket when no betterAuth options are configured", async () => {
    const socket = makeSocket({
      decodedToken: {authKind: "better-auth", id: "u1"},
      encodedToken: "session-token",
    });
    const outcome = await revalidateSocketSession(socket, {});
    expect(outcome).toBe("invalid-session");
  });

  it("returns disabled when the reloaded full user has disabled: true", async () => {
    const socket = makeSocket({decodedToken: {authKind: "jwt", id: "u1"}});
    const outcome = await revalidateSocketSession(socket, {
      userModel: fakeUserModel({u1: {_id: "u1", disabled: true}}),
    });
    expect(outcome).toBe("disabled");
  });

  it("returns invalid-session when the user no longer exists", async () => {
    const socket = makeSocket({decodedToken: {authKind: "jwt", id: "gone"}});
    const outcome = await revalidateSocketSession(socket, {userModel: fakeUserModel({})});
    expect(outcome).toBe("invalid-session");
  });

  it("refreshes socket.data.fullUser on success (D2)", async () => {
    const user = {_id: "u1", disabled: false, organizationIds: ["org-a"]};
    const socket = makeSocket({decodedToken: {authKind: "jwt", id: "u1"}});
    const outcome = await revalidateSocketSession(socket, {userModel: fakeUserModel({u1: user})});
    expect(outcome).toBe("valid");
    expect(socket.data?.fullUser).toEqual(user);
  });

  it("returns valid when no userModel is configured (no disabled check possible)", async () => {
    const socket = makeSocket({decodedToken: {authKind: "jwt", id: "u1"}});
    const outcome = await revalidateSocketSession(socket, {});
    expect(outcome).toBe("valid");
  });
});

describe("reresolveSyncRoomsForSocket (D4)", () => {
  afterEach(() => {
    clearSyncRegistry();
  });

  it("leaves a room for a tenant the user no longer belongs to and joins a newly granted one", async () => {
    registerSync({
      config: {scope: {field: "organizationId", type: "tenant"}},
      model: RevalTenantModel,
      options: {permissions: {create: [], delete: [], list: [], read: [], update: []}} as any,
      routePath: "/projects",
    });

    const subscriptions = new Map<string, Set<string>>([
      ["projects", new Set(["sync:projects|tenant:org-old"])],
    ]);
    const socket = makeSocket({
      data: {fullUser: {id: "u1"}, syncSubscriptions: subscriptions},
      decodedToken: {authKind: "jwt", id: "u1"},
    });

    await reresolveSyncRoomsForSocket(socket, {
      sync: {getUserScopes: () => ["org-new"]},
    });

    expect(socket.leave).toHaveBeenCalledWith("sync:projects|tenant:org-old");
    expect(socket.join).toHaveBeenCalledWith("sync:projects|tenant:org-new");
    expect(subscriptions.get("projects")).toEqual(new Set(["sync:projects|tenant:org-new"]));
  });

  it("does nothing when the socket has no sync subscriptions", async () => {
    const socket = makeSocket({decodedToken: {authKind: "jwt", id: "u1"}});
    await reresolveSyncRoomsForSocket(socket, {});
    expect(socket.leave).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
  });

  it("leaves all rooms when getUserScopes returns no memberships (full revocation)", async () => {
    registerSync({
      config: {scope: {field: "organizationId", type: "tenant"}},
      model: RevalTenantModel,
      options: {permissions: {create: [], delete: [], list: [], read: [], update: []}} as any,
      routePath: "/projects",
    });
    const subscriptions = new Map<string, Set<string>>([
      ["projects", new Set(["sync:projects|tenant:org-a"])],
    ]);
    const socket = makeSocket({
      data: {fullUser: {id: "u1"}, syncSubscriptions: subscriptions},
      decodedToken: {authKind: "jwt", id: "u1"},
    });

    await reresolveSyncRoomsForSocket(socket, {sync: {getUserScopes: () => []}});

    expect(socket.leave).toHaveBeenCalledWith("sync:projects|tenant:org-a");
    expect(socket.join).not.toHaveBeenCalled();
    expect(subscriptions.get("projects")).toEqual(new Set());
  });

  it("keeps an owner-scoped room untouched (always the socket's own userId)", async () => {
    registerSync({
      config: {scope: {type: "owner"}},
      model: RevalOwnerModel,
      options: {permissions: {create: [], delete: [], list: [], read: [], update: []}} as any,
      routePath: "/todos",
    });
    const subscriptions = new Map<string, Set<string>>([
      ["todos", new Set(["sync:todos|owner:u1"])],
    ]);
    const socket = makeSocket({
      data: {fullUser: {id: "u1"}, syncSubscriptions: subscriptions},
      decodedToken: {authKind: "jwt", id: "u1"},
    });

    await reresolveSyncRoomsForSocket(socket, {});

    expect(socket.leave).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
  });
});

describe("runSessionRevalidationSweep", () => {
  it("disconnects an expired socket, emitting sync:auth-expired first", async () => {
    const socket = makeSocket({
      decodedToken: {
        authKind: "jwt",
        exp: DateTime.now().minus({minutes: 1}).toSeconds(),
        id: "u1",
      },
    });
    const io = {sockets: {sockets: new Map([["socket-1", socket]])}} as any;

    await runSessionRevalidationSweep(io, {});

    expect(socket.emit).toHaveBeenCalledWith("sync:auth-expired", {reason: "expired"});
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it("disconnects a disabled user's socket", async () => {
    const socket = makeSocket({decodedToken: {authKind: "jwt", id: "u1"}});
    const io = {sockets: {sockets: new Map([["socket-1", socket]])}} as any;

    await runSessionRevalidationSweep(io, {
      userModel: fakeUserModel({u1: {_id: "u1", disabled: true}}),
    });

    expect(socket.emit).toHaveBeenCalledWith("sync:auth-expired", {reason: "disabled"});
    expect(socket.disconnect).toHaveBeenCalledWith(true);
  });

  it("leaves a valid socket connected and does not emit sync:auth-expired", async () => {
    const socket = makeSocket({
      decodedToken: {
        authKind: "jwt",
        exp: DateTime.now().plus({minutes: 10}).toSeconds(),
        id: "u1",
      },
    });
    const io = {sockets: {sockets: new Map([["socket-1", socket]])}} as any;

    await runSessionRevalidationSweep(io, {});

    expect(socket.emit).not.toHaveBeenCalled();
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it("continues sweeping other sockets when one throws", async () => {
    const throwing = makeSocket({
      decodedToken: {authKind: "jwt", id: "throws"},
      id: "socket-throws",
    });
    const expired = makeSocket({
      decodedToken: {
        authKind: "jwt",
        exp: DateTime.now().minus({minutes: 1}).toSeconds(),
        id: "u2",
      },
      id: "socket-expired",
    });
    const throwingUserModel = {
      find: async () => {
        throw new Error("db unavailable");
      },
    };
    const io = {
      sockets: {
        sockets: new Map([
          ["socket-throws", throwing],
          ["socket-expired", expired],
        ]),
      },
    } as any;

    await runSessionRevalidationSweep(io, {userModel: throwingUserModel as any});

    // The throwing socket's error is caught and logged; it is left connected rather
    // than disconnected on an ambiguous internal failure.
    expect(throwing.disconnect).not.toHaveBeenCalled();
    expect(expired.disconnect).toHaveBeenCalledWith(true);
  });
});

describe("startSessionRevalidationSweep", () => {
  it("does not arm a timer when intervalMs is 0", () => {
    const io = {sockets: {sockets: new Map()}} as any;
    const handle = startSessionRevalidationSweep(io, {intervalMs: 0});
    // No assertion beyond "does not throw" is possible without reaching into timer
    // internals; stop() must be a safe no-op either way.
    expect(() => handle.stop()).not.toThrow();
  });

  it("returns a handle whose stop() clears the interval", () => {
    const io = {sockets: {sockets: new Map()}} as any;
    const handle = startSessionRevalidationSweep(io, {intervalMs: 60_000});
    expect(() => handle.stop()).not.toThrow();
    // Calling stop() twice must also be safe.
    expect(() => handle.stop()).not.toThrow();
  });

  it("resolves an options thunk fresh on every tick (no staleness from a captured snapshot)", async () => {
    // Regression for the same staleness bug fixed for the JWT issuer thunk: a
    // static options object captured once at RealtimeApp.onServerCreated() time
    // would use whatever `sync.getUserScopes` was published at that instant,
    // even if SyncApp registers (or its options change) afterwards.
    registerSync({
      config: {scope: {field: "organizationId", type: "tenant"}},
      model: RevalTenantModel,
      options: {permissions: {create: [], delete: [], list: [], read: [], update: []}} as any,
      routePath: "/projects",
    });
    const user = {_id: "u1", disabled: false};
    let scopesAtLastTick: string[] = [];
    const socket = makeSocket({
      data: {
        fullUser: user,
        syncSubscriptions: new Map([["projects", new Set(["sync:projects|tenant:org-v1"])]]),
      },
      decodedToken: {authKind: "jwt", id: "u1"},
    });
    const io = {sockets: {sockets: new Map([["socket-1", socket]])}} as any;
    let currentScopes = ["org-v1"];

    const handle = startSessionRevalidationSweep(io, () => ({
      intervalMs: 20,
      sync: {
        getUserScopes: () => {
          scopesAtLastTick = currentScopes;
          return currentScopes;
        },
      },
      userModel: fakeUserModel({u1: user}),
    }));

    await settleFor(60);
    expect(scopesAtLastTick).toEqual(["org-v1"]);

    currentScopes = ["org-v2"];
    await settleFor(60);
    expect(scopesAtLastTick).toEqual(["org-v2"]);

    handle.stop();
    clearSyncRegistry();
  });
});

const settleFor = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("loadFullUserForSocket (D2)", () => {
  it("populates socket.data.fullUser from the decoded token's id", async () => {
    const user = {_id: "u1", organizationIds: ["org-a"]};
    const socket: any = {data: {}, decodedToken: {id: "u1"}, id: "socket-1"};

    await loadFullUserForSocket(socket, fakeUserModel({u1: user}));

    expect(socket.data.fullUser).toEqual(user);
  });

  it("is a no-op when no userModel is configured", async () => {
    const socket: any = {data: {}, decodedToken: {id: "u1"}, id: "socket-1"};
    await loadFullUserForSocket(socket, undefined);
    expect(socket.data.fullUser).toBeUndefined();
  });

  it("is a no-op when the decoded token has no id", async () => {
    const socket: any = {data: {}, decodedToken: {}, id: "socket-1"};
    await loadFullUserForSocket(socket, fakeUserModel({u1: {_id: "u1"}}));
    expect(socket.data.fullUser).toBeUndefined();
  });

  it("swallows a lookup error and leaves fullUser unset", async () => {
    const throwingModel = {
      find: async () => {
        throw new Error("db down");
      },
    };
    const socket: any = {data: {}, decodedToken: {id: "u1"}, id: "socket-1"};
    await loadFullUserForSocket(socket, throwingModel as any);
    expect(socket.data.fullUser).toBeUndefined();
  });
});
