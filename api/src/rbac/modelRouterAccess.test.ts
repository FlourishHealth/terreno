import {describe, expect, it} from "bun:test";
import {assert} from "chai";
import mongoose from "mongoose";

import type {User} from "../auth";
import {Permissions} from "../permissions";
import {setupDb} from "../tests";
import {createAccess} from "./access";
import {
  buildAccessPermissions,
  buildAccessQueryFilter,
  resolveActionForMethod,
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

const createTestUser = (
  roles: string[] = []
): User & {roles: string[]} & {
  [key: string]: unknown;
} => {
  const id = new mongoose.Types.ObjectId();
  return {
    _id: id as unknown as User["_id"],
    admin: false,
    id: id.toString(),
    roles,
  };
};

/**
 * Minimal TerrenoAccess stub for the filter-merging branches, which depend only on
 * `statements` and `queryFilter` and would otherwise need a seeded role per case.
 */
const createAccessStub = (
  scopeFilter: Record<string, unknown> | null
): AnyTerrenoAccess & {queryFilterCalls: number} => {
  const stub = {
    queryFilter: async () => {
      stub.queryFilterCalls += 1;
      return scopeFilter;
    },
    queryFilterCalls: 0,
    statements: appStatements,
  };
  return stub as unknown as AnyTerrenoAccess & {queryFilterCalls: number};
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
      [
        {secret: "hidden", title: "One"},
        {secret: "hidden", title: "Two"},
      ],
      "list",
      {user: createTestUser(["reader"])} as never,
      {}
    );
    expect(masked).toEqual([{title: "One"}, {title: "Two"}]);
  });

  it("masks create responses with the read phase, not createView", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      defaultRoles: [
        {
          displayName: "Creator",
          name: "creator",
          permissions: {todo: ["create", "read"]},
        },
      ],
      fieldViews: {
        todo: {
          createView: "deny",
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
      {secret: "hidden", title: "Created"},
      "create",
      {user: createTestUser(["creator"])} as never,
      {}
    );
    expect(masked).toEqual({title: "Created"});
  });

  it("evaluates extra PermissionSets returned from per-router scope.check", async () => {
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
          displayName: "Editor",
          name: "editor",
          permissions: {todo: ["read", "update"]},
        },
      ],
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const permissions = buildAccessPermissions(access as AnyTerrenoAccess, {
      resource: "todo",
      scope: {
        check: () => ({todo: ["update"]}),
      },
    });
    const doc = {title: "Scoped"};
    const readerAllowed = await Promise.all(
      permissions.read.map((check) => check("read", createTestUser(["reader"]), doc))
    );
    const editorAllowed = await Promise.all(
      permissions.read.map((check) => check("read", createTestUser(["editor"]), doc))
    );
    expect(readerAllowed.every(Boolean)).toBe(false);
    expect(editorAllowed.every(Boolean)).toBe(true);
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

  it("resolves actions per method", () => {
    const statements: Record<string, readonly string[]> = appStatements;
    assert.equal(
      resolveActionForMethod("list", {actions: {list: "browse"}, resource: "todo"}, statements),
      "browse"
    );
    assert.isNull(
      resolveActionForMethod("read", {actions: {read: null}, resource: "todo"}, statements)
    );
    assert.equal(resolveActionForMethod("list", {resource: "todo"}, statements), "list");
    assert.equal(resolveActionForMethod("list", {resource: "unknown"}, statements), "read");
    assert.equal(resolveActionForMethod("update", {resource: "todo"}, statements), "update");
  });

  it("returns null when the access scope filter denies every row", async () => {
    const queryFilter = buildAccessQueryFilter(createAccessStub(null), {resource: "todo"});
    assert.isNull(await queryFilter(createTestUser(["reader"]), {completed: false}));
  });

  it("keeps the incoming query when the scope filter is empty", async () => {
    const queryFilter = buildAccessQueryFilter(createAccessStub({}), {resource: "todo"});
    assert.deepEqual(await queryFilter(createTestUser(["reader"]), {completed: false}), {
      completed: false,
    });
  });

  it("skips scope filtering when the list action is disabled", async () => {
    const access = createAccessStub({ownerId: "someone-else"});
    const queryFilter = buildAccessQueryFilter(access, {
      actions: {list: null},
      resource: "todo",
    });

    assert.deepEqual(await queryFilter(createTestUser(["reader"]), {completed: true}), {
      completed: true,
    });
    assert.equal(access.queryFilterCalls, 0);
  });

  it("merges the per-router scope filter on top of the access filter", async () => {
    const queryFilter = buildAccessQueryFilter(createAccessStub({tenantId: "t1"}), {
      resource: "todo",
      scope: {
        filter: async ({user}) => ({ownerId: user.id}),
      },
    });
    const user = createTestUser(["reader"]);

    assert.deepEqual(await queryFilter(user, {completed: false}), {
      $and: [{$and: [{completed: false}, {tenantId: "t1"}]}, {ownerId: user.id}],
    });
  });

  it("denies scope checks for anonymous requests and rejected docs", async () => {
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
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const permissions = buildAccessPermissions(access as AnyTerrenoAccess, {
      resource: "todo",
      scope: {
        check: ({doc}) => (doc as {ownerId?: string} | undefined)?.ownerId === "mine",
      },
    });
    const scopeCheck = permissions.read[1];
    const user = createTestUser(["reader"]);

    assert.isFalse(await scopeCheck("read", undefined, {ownerId: "mine"}));
    assert.isFalse(await scopeCheck("read", user, {ownerId: "theirs"}));
    assert.isTrue(await scopeCheck("read", user, {ownerId: "mine"}));
  });

  it("appends the `also` permission checks after the access checks", async () => {
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
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const permissions = buildAccessPermissions(access as AnyTerrenoAccess, {
      also: {read: [Permissions.IsAdmin]},
      resource: "todo",
    });

    assert.lengthOf(permissions.read, 2);
    assert.isFalse(await permissions.read[1]("read", createTestUser(["reader"])));
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
