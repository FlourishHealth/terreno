import {describe, it} from "bun:test";
import type {AdminModelConfig} from "@terreno/admin-frontend";
import type {BetterAuthClientLike} from "@terreno/syncdb";
import {assert} from "chai";
import {
  createAdminSpaSyncDb,
  createAdminSpaSyncDbConfig,
  resolveAdminSyncCollections,
} from "./adminSyncDb";

const createModel = (overrides: Partial<AdminModelConfig>): AdminModelConfig => ({
  displayName: "Model",
  fields: {_id: {required: true, type: "string"}},
  listFields: [],
  name: "Model",
  routePath: "/admin/models",
  ...overrides,
});

describe("resolveAdminSyncCollections", () => {
  it("returns sorted unique adminBroadcast collections with String ids", () => {
    const collections = resolveAdminSyncCollections([
      createModel({adminBroadcast: true, name: "Todo", syncCollection: "todos"}),
      createModel({adminBroadcast: true, name: "TodoArchive", syncCollection: "todos"}),
      createModel({adminBroadcast: true, name: "Project", syncCollection: "projects"}),
      createModel({
        adminBroadcast: true,
        fields: {_id: {required: true, type: "objectid"}},
        name: "User",
        syncCollection: "users",
      }),
      createModel({adminBroadcast: false, name: "Draft", syncCollection: "drafts"}),
    ]);

    assert.deepEqual(collections, ["projects", "todos"]);
  });
});

describe("createAdminSpaSyncDb", () => {
  const authClient: BetterAuthClientLike = {
    getSession: async () => ({
      data: {session: {token: "session-token"}, user: {id: "admin-1"}},
    }),
  };

  it("builds an origin-scoped window client config with Better Auth", async () => {
    const config = createAdminSpaSyncDbConfig({
      authClient,
      collections: ["todos"],
      origin: "https://admin.example.com",
    });

    assert.equal(config.baseUrl, "https://admin.example.com");
    assert.equal(config.name, "terreno-admin-spa:https://admin.example.com");
    assert.deepEqual(config.collections, ["todos"]);
    assert.deepEqual(config.windowCollections, ["todos"]);
    assert.equal(await config.authProvider.getUserId(), "admin-1");
    assert.equal(await config.authProvider.getToken(), "session-token");
  });

  it("creates the syncdb client surface", () => {
    const client = createAdminSpaSyncDb({
      authClient,
      collections: ["todos"],
      origin: "https://admin.example.com",
    });

    assert.isFunction(client.start);
    assert.isFunction(client.stop);
    assert.isFunction(client.hydrateWindow);
    assert.isFunction(client.mutate);
  });
});
