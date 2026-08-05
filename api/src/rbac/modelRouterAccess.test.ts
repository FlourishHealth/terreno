import {describe, expect, it} from "bun:test";
import mongoose from "mongoose";

import type {User} from "../auth";
import {Permissions} from "../permissions";
import {setupDb} from "../tests";
import {createAccess} from "./access";
import {
  buildAccessPermissions,
  buildAccessQueryFilter,
  resolveModelRouterAccess,
  validateAccessWriteBody,
  wrapAccessResponseHandler,
} from "./modelRouterAccess";
import {OwnerScope} from "./scopes";
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

  it("falls back to read for list when list is not in statements", async () => {
    await setupDb();
    const narrowStatements = {
      ...terrenoStatements,
      note: ["read", "update"],
    } as const;
    const access = createAccess({
      connection: mongoose.connection,
      defaultRoles: [
        {
          displayName: "Reader",
          name: "reader",
          permissions: {note: ["read"]},
        },
      ],
      statements: narrowStatements,
    });
    await access.roles.seedDefaults();

    const permissions = buildAccessPermissions(access as AnyTerrenoAccess, {resource: "note"});
    const user = createTestUser(["reader"]);
    expect(await permissions.list[0]("list", user)).toBe(true);
  });

  it("merges scope filters into query filters", async () => {
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
      scopes: {
        "todo.list": OwnerScope(),
      },
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const queryFilter = buildAccessQueryFilter(access as AnyTerrenoAccess, {resource: "todo"});
    const user = createTestUser(["reader"]);
    const merged = await queryFilter(user, {completed: false});
    expect(merged).toEqual({
      $and: [{completed: false}, {ownerId: user.id}],
    });
  });

  it("returns null when an existing query filter rejects the user", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const queryFilter = buildAccessQueryFilter(
      access as AnyTerrenoAccess,
      {resource: "todo"},
      async () => null
    );
    const user = createTestUser(["superadmin"]);
    expect(await queryFilter(user, {})).toBeNull();
  });

  it("validates write bodies against field masks", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      defaultRoles: [
        {
          displayName: "Writer",
          name: "writer",
          permissions: {todo: ["update"]},
        },
      ],
      fieldViews: {
        todo: {
          select: () => "editable",
          views: {
            editable: {omit: [], read: ["title"], write: ["title"]},
          },
        },
      },
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const user = createTestUser(["writer"]);
    await expect(
      validateAccessWriteBody({
        access: {resource: "todo"},
        accessControl: access as AnyTerrenoAccess,
        body: {admin: true, title: "ok"},
        phase: "write",
        user,
      })
    ).rejects.toMatchObject({
      meta: {fields: {admin: "Field is not writable"}},
      status: 400,
      title: "Validation failed",
    });
  });

  it("wraps response handlers with read masks", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      defaultRoles: [
        {
          displayName: "Reader",
          name: "reader",
          permissions: {todo: ["read"]},
        },
      ],
      fieldViews: {
        todo: {
          select: () => "public",
          views: {
            public: {omit: [], read: ["title"], write: ["title"]},
          },
        },
      },
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const handler = wrapAccessResponseHandler(
      access as AnyTerrenoAccess,
      {resource: "todo"},
      (value) => value
    );

    const masked = await handler(
      [{secret: "hidden", title: "One"}, {secret: "hidden", title: "Two"}],
      "list",
      {user: createTestUser(["reader"])} as never,
      {}
    );
    expect(masked).toEqual([{title: "One"}, {title: "Two"}]);
  });

  it("uses scope from resolveModelRouterAccess when access.scope is omitted", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const resolved = resolveModelRouterAccess({
      access: {resource: "todo"},
      accessControl: access as AnyTerrenoAccess,
      scope: OwnerScope(),
    });

    expect(resolved.permissions).toBeDefined();
    expect(resolved.queryFilter).toBeDefined();
    expect(resolved.responseHandler).toBeDefined();
  });

  it("returns legacy permissions when access config is absent", () => {
    const permissions = {
      create: [Permissions.IsAdmin],
      delete: [],
      list: [Permissions.IsAdmin],
      read: [Permissions.IsAdmin],
      update: [Permissions.IsAdmin],
    };

    const resolved = resolveModelRouterAccess({permissions});
    expect(resolved.permissions).toBe(permissions);
  });

  it("throws when neither access nor permissions are provided", () => {
    expect(() => resolveModelRouterAccess({})).toThrow(
      "modelRouter requires permissions or access with accessControl"
    );
  });
});
