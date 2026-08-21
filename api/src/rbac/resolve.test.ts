import {describe, expect, it, mock} from "bun:test";
import mongoose from "mongoose";

import type {User} from "../auth";
import {setupDb} from "../tests";
import {createPermissionResolver} from "./resolve";
import {createRbacRoleModel} from "./roleModel";
import {terrenoStatements} from "./statements";
import type {PermissionSource} from "./types";

const appStatements = {
  ...terrenoStatements,
  todo: ["create", "read", "update", "delete", "list"],
} as const;

const createTestUser = (
  overrides: Partial<User & {roles: string[]}> = {}
): User & {roles: string[]} => {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id as unknown as User["_id"],
    admin: false,
    id: id.toString(),
    roles: [],
    ...overrides,
  };
};

describe("createPermissionResolver", () => {
  it("caches resolved permissions until invalidated", async () => {
    await setupDb();
    const RbacRole = createRbacRoleModel(mongoose.connection);
    await RbacRole.seedDefaults({statements: appStatements});
    await RbacRole.findOneAndUpdate(
      {name: "reader"},
      {
        $set: {
          displayName: "Reader",
          name: "reader",
          permissions: {todo: ["read"]},
        },
      },
      {upsert: true}
    );

    const resolver = createPermissionResolver({
      cacheTtlMs: 60_000,
      rbacRoleModel: RbacRole,
      statements: appStatements,
    });

    const user = createTestUser({roles: ["reader"]});
    const first = await resolver.resolvePermissionsForUser(user);
    expect(first.todo).toEqual(["read"]);

    user.roles = [];
    const cached = await resolver.resolvePermissionsForUser(user);
    expect(cached.todo).toEqual(["read"]);

    resolver.invalidateCache({userId: user.id});
    const refreshed = await resolver.resolvePermissionsForUser(user);
    expect(refreshed.todo).toBeUndefined();
  });

  it("clears all cached permissions when invalidateCache is called without userId", async () => {
    await setupDb();
    const RbacRole = createRbacRoleModel(mongoose.connection);
    await RbacRole.seedDefaults({statements: appStatements});

    const resolver = createPermissionResolver({
      cacheTtlMs: 60_000,
      rbacRoleModel: RbacRole,
      statements: appStatements,
    });

    const userA = createTestUser({roles: ["member"]});
    const userB = createTestUser({roles: ["member"]});
    await resolver.resolvePermissionsForUser(userA);
    await resolver.resolvePermissionsForUser(userB);

    resolver.invalidateCache();
    userA.roles = ["superadmin"];
    const refreshed = await resolver.resolvePermissionsForUser(userA);
    expect(refreshed.todo).toEqual(expect.arrayContaining(["read", "update"]));
  });

  it("merges permission source grants and applies deny rules", async () => {
    await setupDb();
    const RbacRole = createRbacRoleModel(mongoose.connection);
    await RbacRole.seedDefaults({statements: appStatements});

    const source: PermissionSource = {
      getGrants: async () => ({
        deny: {todo: ["update"]},
        permissions: {todo: ["read", "update"]},
        roles: ["member"],
      }),
      name: "test-source",
    };

    const resolver = createPermissionResolver({
      rbacRoleModel: RbacRole,
      sources: [source],
      statements: appStatements,
    });

    const user = createTestUser();
    const permissions = await resolver.resolvePermissionsForUser(user);
    expect(permissions.todo).toEqual(["read"]);
  });

  it("uses resolvePermissions callback for custom grants", async () => {
    await setupDb();
    const RbacRole = createRbacRoleModel(mongoose.connection);
    await RbacRole.seedDefaults({statements: appStatements});

    const resolver = createPermissionResolver({
      rbacRoleModel: RbacRole,
      resolvePermissions: async () => ({todo: ["create"]}),
      statements: appStatements,
    });

    const user = createTestUser();
    const permissions = await resolver.resolvePermissionsForUser(user);
    expect(permissions.todo).toEqual(["create"]);
  });

  it("authorizes and denies permission requests", async () => {
    await setupDb();
    const RbacRole = createRbacRoleModel(mongoose.connection);
    await RbacRole.seedDefaults({statements: appStatements});

    const resolver = createPermissionResolver({
      rbacRoleModel: RbacRole,
      statements: appStatements,
    });

    const allowed = resolver.authorizePermissions({todo: ["read"]}, {todo: ["read"]});
    expect(allowed.success).toBe(true);

    const denied = resolver.authorizePermissions({todo: ["read"]}, {todo: ["delete"]});
    expect(denied.success).toBe(false);
    expect(denied.error).toBeDefined();
  });

  it("returns stale grants when a source fails with use-stale policy", async () => {
    await setupDb();
    const RbacRole = createRbacRoleModel(mongoose.connection);
    await RbacRole.seedDefaults({statements: appStatements});

    let shouldFail = false;
    const source: PermissionSource = {
      getGrants: async () => {
        if (shouldFail) {
          throw new Error("source unavailable");
        }
        return {permissions: {todo: ["read"]}};
      },
      name: "flaky-source",
      staleOnFailure: "use-stale",
    };

    const resolver = createPermissionResolver({
      cacheTtlMs: 0,
      rbacRoleModel: RbacRole,
      sources: [source],
      statements: appStatements,
    });

    const user = createTestUser();
    const fresh = await resolver.resolvePermissionsForUser(user);
    expect(fresh.todo).toEqual(["read"]);

    shouldFail = true;
    const stale = await resolver.resolvePermissionsForUser(user);
    expect(stale.todo).toEqual(["read"]);
  });

  it("returns stale grants within bounded age when use-stale-bounded is configured", async () => {
    await setupDb();
    const RbacRole = createRbacRoleModel(mongoose.connection);
    await RbacRole.seedDefaults({statements: appStatements});

    let shouldFail = false;
    const source: PermissionSource = {
      getGrants: async () => {
        if (shouldFail) {
          throw new Error("source unavailable");
        }
        return {permissions: {todo: ["list"]}};
      },
      name: "bounded-source",
      staleMaxAgeMs: 60_000,
      staleOnFailure: "use-stale-bounded",
    };

    const resolver = createPermissionResolver({
      cacheTtlMs: 0,
      rbacRoleModel: RbacRole,
      sources: [source],
      statements: appStatements,
    });

    const user = createTestUser();
    const fresh = await resolver.resolvePermissionsForUser(user);
    expect(fresh.todo).toEqual(["list"]);

    shouldFail = true;
    const stale = await resolver.resolvePermissionsForUser(user);
    expect(stale.todo).toEqual(["list"]);
  });

  it("skips failed sources when stale policy is deny", async () => {
    await setupDb();
    const RbacRole = createRbacRoleModel(mongoose.connection);
    await RbacRole.seedDefaults({statements: appStatements});

    const source: PermissionSource = {
      getGrants: mock(async () => {
        throw new Error("source unavailable");
      }),
      name: "deny-source",
      staleOnFailure: "deny",
    };

    const resolver = createPermissionResolver({
      rbacRoleModel: RbacRole,
      sources: [source],
      statements: appStatements,
    });

    const user = createTestUser({roles: ["member"]});
    const permissions = await resolver.resolvePermissionsForUser(user);
    expect(permissions.todo).toBeUndefined();
  });

  it("evicts the oldest permission cache entry when over maxCacheEntries", async () => {
    await setupDb();
    const RbacRole = createRbacRoleModel(mongoose.connection);
    await RbacRole.seedDefaults({statements: appStatements});

    const resolver = createPermissionResolver({
      cacheTtlMs: 60_000,
      maxCacheEntries: 2,
      rbacRoleModel: RbacRole,
      statements: appStatements,
    });

    const userA = createTestUser({roles: ["member"]});
    const userB = createTestUser({roles: ["member"]});
    const userC = createTestUser({roles: ["member"]});
    await resolver.resolvePermissionsForUser(userA);
    await resolver.resolvePermissionsForUser(userB);
    await resolver.resolvePermissionsForUser(userC);

    await RbacRole.findOneAndUpdate(
      {name: "cache-evict-reader"},
      {
        $set: {
          displayName: "Cache Evict Reader",
          name: "cache-evict-reader",
          permissions: {todo: ["read"]},
        },
      },
      {upsert: true}
    );
    userA.roles = ["cache-evict-reader"];
    const refreshed = await resolver.resolvePermissionsForUser(userA);
    expect(refreshed.todo).toEqual(["read"]);
  });
});
