import {describe, expect, it, mock} from "bun:test";
import mongoose from "mongoose";

import type {User} from "../auth";
import {type APIError, isAPIError} from "../errors";
import {Permissions} from "../permissions";
import {setupDb} from "../tests";
import {createAccess} from "./access";
import {assertAllowed} from "./assertAllowed";
import {terrenoStatements} from "./statements";
import type {AnyTerrenoAccess} from "./types";

const appStatements = {
  ...terrenoStatements,
  todo: ["create", "read", "update", "delete", "list"],
} as const;

const createUser = (
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

const fullLegacyPermissions = {
  create: [Permissions.IsAny],
  delete: [Permissions.IsAny],
  list: [Permissions.IsAny],
  read: [Permissions.IsAny],
  update: [Permissions.IsAny],
};

describe("assertAllowed", () => {
  it("allows access when can() passes even if legacy permissions would deny", async () => {
    const user = createUser();
    const can = mock(async () => ({allowed: true}));
    const accessControl = {
      can,
      statements: appStatements,
    } as unknown as AnyTerrenoAccess;

    await assertAllowed({
      method: "create",
      options: {
        access: {resource: "todo"},
        accessControl,
        permissions: {
          ...fullLegacyPermissions,
          create: [Permissions.IsAdmin],
        },
      },
      user,
    });

    expect(can).toHaveBeenCalled();
  });

  it("throws 405 when legacy permissions array is empty", async () => {
    const user = createUser({admin: true});

    await expect(
      assertAllowed({
        method: "delete",
        options: {
          permissions: {
            ...fullLegacyPermissions,
            delete: [],
          },
        },
        user,
      })
    ).rejects.toMatchObject({status: 405});
  });

  it("throws 403 when can() denies", async () => {
    const user = createUser();
    const can = mock(async () => ({
      allowed: false,
      deniedBy: "role" as const,
      reason: "Missing todo:create",
    }));
    const accessControl = {
      can,
      statements: appStatements,
    } as unknown as AnyTerrenoAccess;

    await expect(
      assertAllowed({
        method: "create",
        options: {
          access: {resource: "todo"},
          accessControl,
          permissions: fullLegacyPermissions,
        },
        user,
      })
    ).rejects.toMatchObject({
      detail: "Missing todo:create",
      status: 403,
      title: "Access denied",
    });
  });

  it("applies legacy AND semantics across permission methods", async () => {
    const user = createUser();

    await expect(
      assertAllowed({
        method: "create",
        options: {
          permissions: {
            ...fullLegacyPermissions,
            create: [Permissions.IsAuthenticated, Permissions.IsAdmin],
          },
        },
        user,
      })
    ).rejects.toMatchObject({status: 405});
  });

  it("throws 403 for legacy object-level denial when doc is provided", async () => {
    const ownerId = new mongoose.Types.ObjectId();
    const user = createUser();
    const doc = {ownerId: ownerId.toString()} as {ownerId: string};

    try {
      await assertAllowed({
        doc,
        method: "read",
        options: {
          permissions: {
            ...fullLegacyPermissions,
            read: [Permissions.IsOwner],
          },
        },
        user,
      });
      throw new Error("expected assertAllowed to throw");
    } catch (error) {
      expect(isAPIError(error)).toBe(true);
      expect((error as APIError).status).toBe(403);
    }
  });

  it("throws 405 when RBAC action is disabled", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      statements: appStatements,
    });
    await access.roles.seedDefaults();
    const user = createUser({roles: ["superadmin"]});

    await expect(
      assertAllowed({
        method: "delete",
        options: {
          access: {actions: {delete: null}, resource: "todo"},
          accessControl: access as AnyTerrenoAccess,
          permissions: fullLegacyPermissions,
        },
        user,
      })
    ).rejects.toMatchObject({status: 405});
  });

  it("denies RBAC create via real can() when role lacks permission", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      defaultRoles: [
        {
          displayName: "Reader",
          name: "reader",
          permissions: {todo: ["read", "list"]},
        },
      ],
      statements: appStatements,
    });
    await access.roles.seedDefaults();
    const user = createUser({roles: ["reader"]});

    await expect(
      assertAllowed({
        method: "create",
        options: {
          access: {resource: "todo"},
          accessControl: access as AnyTerrenoAccess,
          permissions: fullLegacyPermissions,
        },
        user,
      })
    ).rejects.toMatchObject({status: 403});
  });
});
