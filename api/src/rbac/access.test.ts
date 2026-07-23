import {describe, expect, it} from "bun:test";
import {createAccessControl} from "better-auth/plugins/access";
import mongoose from "mongoose";
import type {User} from "../auth";
import {setupDb} from "../tests";
import {createAccess} from "./access";
import {createRbacRoleModel} from "./roleModel";
import {terrenoStatements} from "./statements";

const appStatements = {
  ...terrenoStatements,
  todo: ["create", "read", "update", "delete", "list"],
} as const;

const createTestUser = (
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

describe("createAccess", () => {
  it("allows a user with a matching role permission", async () => {
    await setupDb();
    const RbacRole = createRbacRoleModel(mongoose.connection);
    const access = createAccess({
      connection: mongoose.connection,
      defaultRoles: [
        {
          displayName: "Editor",
          name: "editor",
          permissions: {todo: ["read", "update"]},
        },
      ],
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const user = createTestUser({roles: ["editor"]});
    const result = await access.can({
      permissions: {todo: ["read"]},
      user,
    });

    expect(result.allowed).toBe(true);
    expect(RbacRole).toBeDefined();
  });

  it("denies when the user lacks the required permission", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      defaultRoles: [
        {
          displayName: "Viewer",
          name: "viewer",
          permissions: {todo: ["read"]},
        },
      ],
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const user = createTestUser({roles: ["viewer"]});
    const result = await access.can({
      permissions: {todo: ["update"]},
      user,
    });

    expect(result.allowed).toBe(false);
    expect(result.deniedBy).toBe("role");
  });

  it("returns effective permissions as a union across roles", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      defaultRoles: [
        {
          displayName: "Reader",
          name: "reader",
          permissions: {todo: ["read"]},
        },
        {
          displayName: "Writer",
          name: "writer",
          permissions: {todo: ["update"]},
        },
      ],
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const user = createTestUser({roles: ["reader", "writer"]});
    const permissions = await access.getPermissions({user});

    expect(permissions.todo).toEqual(expect.arrayContaining(["read", "update"]));
  });

  it("exposes the better-auth access controller", () => {
    const access = createAccess({
      connection: mongoose.connection,
      statements: appStatements,
    });

    expect(access.ac).toBeDefined();
    expect(access.ac.statements).toEqual(appStatements);
    expect(createAccessControl(appStatements)).toBeDefined();
  });
});
