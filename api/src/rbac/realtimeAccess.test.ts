import {describe, expect, it} from "bun:test";
import mongoose from "mongoose";

import type {User} from "../auth";
import {Permissions} from "../permissions";
import type {RealtimeRegistryEntry} from "../realtime/registry";
import {setupDb} from "../tests";
import {createAccess} from "./access";
import {
  canReadDocumentRealtime,
  canSubscribeRealtime,
  maskRealtimeDocument,
} from "./realtimeAccess";
import {OwnerScope} from "./scopes";
import {terrenoStatements} from "./statements";
import type {AnyTerrenoAccess} from "./types";

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

const makeEntry = (options: RealtimeRegistryEntry["options"]): RealtimeRegistryEntry => ({
  collectionName: "todos",
  config: {methods: ["create", "update", "delete"], roomStrategy: "owner"},
  modelName: "Todo",
  options,
  routePath: "/todos",
});

describe("realtimeAccess", () => {
  it("uses accessControl permissions for subscriptions", async () => {
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

    const user = createTestUser({roles: ["reader"]});
    const entry = makeEntry({
      access: {resource: "todo"},
      accessControl: access as AnyTerrenoAccess,
    });

    expect(await canSubscribeRealtime(entry, "list", user)).toBe(true);
    expect(await canSubscribeRealtime(entry, "read", user)).toBe(true);
  });

  it("returns false when the realtime action override is null", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const user = createTestUser({roles: ["superadmin"]});
    const entry = makeEntry({
      access: {actions: {list: null}, resource: "todo"},
      accessControl: access as AnyTerrenoAccess,
    });

    expect(await canSubscribeRealtime(entry, "list", user)).toBe(false);
  });

  it("honors custom action overrides for realtime subscriptions", async () => {
    await setupDb();
    const access = createAccess({
      connection: mongoose.connection,
      defaultRoles: [
        {
          displayName: "Updater",
          name: "updater",
          permissions: {todo: ["update"]},
        },
      ],
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const user = createTestUser({roles: ["updater"]});
    const entry = makeEntry({
      access: {actions: {list: "update"}, resource: "todo"},
      accessControl: access as AnyTerrenoAccess,
    });

    expect(await canSubscribeRealtime(entry, "list", user)).toBe(true);
  });

  it("falls back to legacy permissions when access config is absent", async () => {
    const user = createTestUser({admin: true});
    const entry = makeEntry({
      permissions: {
        create: [Permissions.IsAdmin],
        delete: [Permissions.IsAdmin],
        list: [Permissions.IsAdmin],
        read: [Permissions.IsAdmin],
        update: [Permissions.IsAdmin],
      },
    });

    expect(await canSubscribeRealtime(entry, "list", user)).toBe(true);
    expect(await canSubscribeRealtime(entry, "list", createTestUser())).toBe(false);
  });

  it("checks document-level access with scopes", async () => {
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
        "todo.read": OwnerScope(),
      },
      statements: appStatements,
    });
    await access.roles.seedDefaults();

    const user = createTestUser({roles: ["reader"]});
    const entry = makeEntry({
      access: {resource: "todo"},
      accessControl: access as AnyTerrenoAccess,
    });

    expect(await canReadDocumentRealtime(entry, user, {ownerId: user.id, title: "Mine"})).toBe(
      true
    );
    expect(
      await canReadDocumentRealtime(entry, user, {
        ownerId: new mongoose.Types.ObjectId().toString(),
        title: "Other",
      })
    ).toBe(false);
  });

  it("applies per-router access.scope on realtime document reads", async () => {
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
    const entry = makeEntry({
      access: {
        resource: "todo",
        scope: {
          check: ({doc}) => (doc as {ownerId?: string} | undefined)?.ownerId === user.id,
        },
      },
      accessControl: access as AnyTerrenoAccess,
    });

    expect(await canReadDocumentRealtime(entry, user, {ownerId: user.id, title: "Mine"})).toBe(
      true
    );
    expect(
      await canReadDocumentRealtime(entry, user, {
        ownerId: new mongoose.Types.ObjectId().toString(),
        title: "Other",
      })
    ).toBe(false);
  });

  it("masks realtime documents using field views", async () => {
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

    const user = createTestUser({roles: ["reader"]});
    const entry = makeEntry({
      access: {resource: "todo"},
      accessControl: access as AnyTerrenoAccess,
    });

    const masked = await maskRealtimeDocument(
      entry,
      user,
      {secret: "hidden", title: "Visible"},
      "read"
    );
    expect(masked).toEqual({title: "Visible"});
  });

  it("returns documents unchanged when access config is missing", async () => {
    const entry = makeEntry({});
    const doc = {title: "Plain"};
    expect(await maskRealtimeDocument(entry, undefined, doc, "read")).toBe(doc);
  });
});
