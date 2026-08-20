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

  it("denies unauthenticated access checks", async () => {
    const access = createAccess({
      connection: mongoose.connection,
      statements: appStatements,
    });

    const result = await access.can({
      permissions: {todo: ["read"]},
      user: undefined,
    });

    expect(result).toEqual({
      allowed: false,
      deniedBy: "role",
      reason: "Unauthenticated",
    });
  });

  it("applies scope checks and filters on documents and queries", async () => {
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
        "todo.*": {
          check: async ({doc, user}) => {
            if (!doc || !user) {
              return true;
            }
            return (doc as {ownerId?: string}).ownerId === user.id;
          },
          filter: async ({user}) => ({ownerId: user.id}),
        },
      },
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const user = createTestUser({roles: ["reader"]});
    const ownDoc = {ownerId: user.id, title: "Mine"};
    const otherDoc = {ownerId: new mongoose.Types.ObjectId().toString(), title: "Other"};

    expect(
      await access.can({
        doc: ownDoc,
        permissions: {todo: ["read"]},
        user,
      })
    ).toEqual({allowed: true});

    expect(
      await access.can({
        doc: otherDoc,
        permissions: {todo: ["read"]},
        user,
      })
    ).toEqual({allowed: false, deniedBy: "scope", reason: "Denied by todo.read"});

    expect(await access.queryFilter({action: "list", resource: "todo", user})).toEqual({
      ownerId: user.id,
    });
    expect(await access.queryFilter({action: "list", resource: "todo", user: undefined})).toBe(
      null
    );
  });

  it("denies scope checks that require extra permissions", async () => {
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
      scopes: {
        "todo.read": {
          check: async () => ({todo: ["update"]}),
        },
      },
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const user = createTestUser({roles: ["reader"]});
    const result = await access.can({
      doc: {title: "Todo"},
      permissions: {todo: ["read"]},
      user,
    });

    expect(result.allowed).toBe(false);
    expect(result.deniedBy).toBe("scope");
  });

  it("returns empty query filters when scopes have no filter", async () => {
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

    const user = createTestUser({roles: ["reader"]});
    expect(await access.queryFilter({action: "read", resource: "todo", user})).toEqual({});
  });

  it("applies field views for read and write phases", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      defaultRoles: [
        {
          displayName: "Reader",
          name: "reader",
          permissions: {todo: ["read", "update"]},
        },
      ],
      fieldViews: {
        todo: {
          select: ({phase}) => (phase === "write" ? "editable" : "public"),
          views: {
            editable: {omit: [], read: ["title"], write: ["title"]},
            public: {omit: [], read: ["title"], write: []},
          },
        },
      },
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const user = createTestUser({roles: ["reader"]});
    const readMask = await access.fieldMask({
      doc: {secret: "hidden", title: "Todo"},
      phase: "read",
      resource: "todo",
      user,
    });
    expect(readMask.read).toEqual(["title"]);

    const writeMask = await access.fieldMask({
      doc: {secret: "hidden", title: "Todo"},
      phase: "write",
      resource: "todo",
      user,
    });
    expect(writeMask.write).toEqual(["title"]);

    const anonymousMask = await access.fieldMask({
      resource: "todo",
      user: undefined,
    });
    expect(anonymousMask).toEqual({omit: [], read: "*", write: "*"});
  });

  it("returns custom field masks from select callbacks", async () => {
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
          select: () => ({omit: [], read: ["title"], write: ["title"]}),
          views: {},
        },
      },
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const user = createTestUser({roles: ["reader"]});
    const mask = await access.fieldMask({
      resource: "todo",
      user,
    });
    expect(mask.read).toEqual(["title"]);
  });

  it("honors createView deny and unknown view names as empty masks", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      defaultRoles: [
        {
          displayName: "Writer",
          name: "writer",
          permissions: {todo: ["create"]},
        },
      ],
      fieldViews: {
        todo: {
          createView: "deny",
          select: () => "missing",
          views: {
            public: {omit: [], read: ["title"], write: ["title"]},
          },
        },
      },
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const user = createTestUser({roles: ["writer"]});
    const createMask = await access.fieldMask({
      phase: "create",
      resource: "todo",
      user,
    });
    expect(createMask.write).toEqual([]);

    const readMask = await access.fieldMask({
      phase: "read",
      resource: "todo",
      user,
    });
    expect(readMask.write).toEqual([]);
  });
});
