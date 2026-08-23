import {describe, expect, it} from "bun:test";
import mongoose from "mongoose";

import type {User} from "../auth";
import {setupDb} from "../tests";
import {createAccess} from "./access";
import {createRequireAccess} from "./middleware";
import {
  diffPermissionSets,
  isPermissionSubset,
  unionPermissionSets,
  validatePermissionSet,
} from "./permissionUtils";
import {terrenoStatements} from "./statements";

const appStatements = {
  ...terrenoStatements,
  todo: ["create", "read", "update", "delete", "list"],
} as const;

const createUser = (
  overrides: Partial<User & {roles: string[]}> = {}
): User & {
  roles: string[];
} => {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id as unknown as User["_id"],
    admin: false,
    id: id.toString(),
    roles: [],
    ...overrides,
  };
};

describe("rbac permission utils and middleware", () => {
  it("unions permission sets across roles", () => {
    const merged = unionPermissionSets({todo: ["read"]}, {todo: ["update"], user: ["read"]});
    expect(merged.todo).toEqual(expect.arrayContaining(["read", "update"]));
    expect(merged.user).toEqual(["read"]);
  });

  it("validates permissions against the statement vocabulary", () => {
    expect(() => validatePermissionSet({todo: ["read"]}, appStatements)).not.toThrow();
    expect(() => validatePermissionSet({unknown: ["read"]}, appStatements)).toThrow(
      "Unknown resource"
    );
    expect(() => validatePermissionSet({todo: ["archive"]}, appStatements)).toThrow(
      "Unknown permission: todo:archive"
    );
  });

  it("diffs permission sets into gained and lost actions", () => {
    const diff = diffPermissionSets(
      {todo: ["read"], user: ["read"]},
      {todo: ["read", "update"], user: ["list"]}
    );

    expect(diff.gained).toEqual({todo: ["update"], user: ["list"]});
    expect(diff.lost).toEqual({user: ["read"]});
  });

  it("checks permission subsets for escalation prevention", () => {
    expect(isPermissionSubset({todo: ["read", "update"]}, {todo: ["read"]})).toBe(true);
    expect(isPermissionSubset({todo: ["read"]}, {todo: ["update"]})).toBe(false);
  });

  it("requireAccess rejects unauthenticated requests", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      statements: appStatements,
    });
    const requireAccess = createRequireAccess({can: access.can});
    const middleware = requireAccess({todo: ["read"]});

    let capturedError: unknown;
    await middleware({user: undefined} as never, {} as never, (error?: unknown) => {
      capturedError = error;
    });
    expect(capturedError).toMatchObject({status: 403});
  });

  it("caches permissions until invalidateCache is called", async () => {
    await setupDb();
    const access = createAccess({
      cacheTtlMs: 60_000,
      connection: mongoose.connection,
      defaultRoles: [
        {
          displayName: "Reader",
          name: "reader",
          permissions: {todo: ["read"]},
        },
      ],
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const user = createUser({roles: ["reader"]});
    const first = await access.getPermissions({user});
    expect(first.todo).toEqual(["read"]);

    user.roles = [];
    const cached = await access.getPermissions({user});
    expect(cached.todo).toEqual(["read"]);

    access.invalidateCache({userId: user.id});
    const refreshed = await access.getPermissions({user});
    expect(refreshed.todo).toBeUndefined();
  });
});
