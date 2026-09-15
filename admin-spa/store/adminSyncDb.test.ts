import {describe, it} from "bun:test";
import type {AdminModelConfig} from "@terreno/admin-frontend";
import {type BetterAuthReactClientLike, createSyncDb} from "@terreno/syncdb";
import {assert} from "chai";
import {createAdminSpaSyncDbConfig, resolveAdminSyncCollections} from "./adminSyncDb";

const BASE_MODEL: AdminModelConfig = {
  defaultSort: "-created",
  displayName: "Model",
  fields: {_id: {required: true, type: "string"}},
  listFields: [],
  name: "Model",
  routePath: "/admin/models",
};

// Spreading Partial<AdminModelConfig> widens required keys to `| undefined`; BASE_MODEL
// already supplies every one of them, so the merged object is complete.
const createModel = (overrides: Partial<AdminModelConfig>): AdminModelConfig =>
  ({...BASE_MODEL, ...overrides}) as AdminModelConfig;

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

describe("createAdminSpaSyncDbConfig", () => {
  const authClient: BetterAuthReactClientLike = {
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

  it("builds a syncdb client from the config", () => {
    const client = createSyncDb(
      createAdminSpaSyncDbConfig({
        authClient,
        collections: ["todos"],
        origin: "https://admin.example.com",
      })
    );

    assert.isFunction(client.start);
    assert.isFunction(client.stop);
    assert.isFunction(client.hydrateWindow);
    assert.isFunction(client.mutate);
  });
});
