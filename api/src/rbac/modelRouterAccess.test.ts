import {describe, expect, it} from "bun:test";
import mongoose from "mongoose";

import type {User} from "../auth";
import {setupDb} from "../tests";
import {createAccess} from "./access";
import {buildAccessPermissions, resolveModelRouterAccess} from "./modelRouterAccess";
import {terrenoStatements} from "./statements";
import type {AnyTerrenoAccess} from "./types";

const appStatements = {
  ...terrenoStatements,
  todo: ["create", "read", "update", "delete", "list"],
} as const;

const createTestUser = (roles: string[] = []): User & {roles: string[]} => {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id as unknown as User["_id"],
    admin: false,
    id: id.toString(),
    roles,
  };
};

describe("modelRouterAccess", () => {
  it("builds permissions from access config", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      defaultRoles: [
        {
          displayName: "Editor",
          name: "editor",
          permissions: {todo: ["read", "update", "list"]},
        },
      ],
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const permissions = buildAccessPermissions(access as AnyTerrenoAccess, {resource: "todo"});
    const user = createTestUser(["editor"]);

    expect(await permissions.list[0]("list", user)).toBe(true);
    expect(await permissions.delete[0]("delete", user)).toBe(false);
  });

  it("disables methods when action is null", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const resolved = resolveModelRouterAccess({
      access: {actions: {delete: null}, resource: "todo"},
      accessControl: access as AnyTerrenoAccess,
    });

    expect(resolved.permissions.delete).toEqual([]);
  });
});
