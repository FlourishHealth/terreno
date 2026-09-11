import {describe, it} from "bun:test";
import type {AdminModelConfig} from "@terreno/admin-frontend";
import {assert} from "chai";
import {resolveAdminSyncCollections} from "./adminSyncDb";

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
