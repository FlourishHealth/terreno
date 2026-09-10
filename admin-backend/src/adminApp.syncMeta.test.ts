import {afterEach, beforeEach, describe, it} from "bun:test";
import {
  addAuthRoutes,
  apiErrorMiddleware,
  apiUnauthorizedMiddleware,
  clearSyncRegistry,
  createdUpdatedPlugin,
  isDeletedPlugin,
  Permissions,
  registerSync,
  setupAuth,
  syncPlugin,
  type UserModel as UserModelType,
} from "@terreno/api";
import {authAsUser, getBaseServer, setupDb, UserModel} from "@terreno/api/testing";
import {assert} from "chai";
import type express from "express";
import mongoose from "mongoose";
import type TestAgent from "supertest/lib/agent";

import type {AdminModelConfig} from "./adminApp";
import {AdminApp} from "./adminApp";

interface ConfigSyncMetaTodo {
  _id: string;
  ownerId: string;
  title: string;
}

const configSyncMetaTodoSchema = new mongoose.Schema<ConfigSyncMetaTodo>({
  _id: {
    default: (): string => new mongoose.Types.ObjectId().toHexString(),
    description: "Client-minted string id",
    type: String,
  },
  ownerId: {description: "The owner", type: String},
  title: {description: "Todo title", required: true, type: String},
});
configSyncMetaTodoSchema.plugin(isDeletedPlugin);
configSyncMetaTodoSchema.plugin(createdUpdatedPlugin);
configSyncMetaTodoSchema.plugin(syncPlugin);

const ConfigSyncMetaTodoModel =
  mongoose.models.ConfigSyncMetaTodo ??
  mongoose.model<ConfigSyncMetaTodo>("ConfigSyncMetaTodo", configSyncMetaTodoSchema);

const todoModelConfig: AdminModelConfig = {
  displayName: "Todos",
  listFields: ["title"],
  model: ConfigSyncMetaTodoModel,
  routePath: "/todos",
};

const syncOptions = {
  permissions: {
    create: [Permissions.IsAuthenticated],
    delete: [Permissions.IsAuthenticated],
    list: [Permissions.IsAuthenticated],
    read: [Permissions.IsAuthenticated],
    update: [Permissions.IsAuthenticated],
  },
  sync: {scope: {type: "owner" as const}},
};

const buildApp = (): express.Application => {
  const app = getBaseServer();
  setupAuth(app, UserModel as unknown as UserModelType);
  addAuthRoutes(app, UserModel as unknown as UserModelType);
  new AdminApp({basePath: "/admin", models: [todoModelConfig]}).register(app);
  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);
  return app;
};

describe("GET /admin/config sync window meta", () => {
  let adminAgent: TestAgent;

  beforeEach(async () => {
    clearSyncRegistry();
    await setupDb();
    adminAgent = await authAsUser(buildApp(), "admin");
  });

  afterEach(() => {
    clearSyncRegistry();
  });

  it("omits syncCollection when the model is not registered for adminBroadcast", async () => {
    const res = await adminAgent.get("/admin/config").expect(200);
    const todoMeta = (res.body.models as Record<string, unknown>[]).find(
      (model) => model.name === "ConfigSyncMetaTodo"
    );
    assert.isDefined(todoMeta);
    assert.strictEqual(todoMeta?.adminBroadcast, false);
    assert.notProperty(todoMeta as object, "syncCollection");
  });

  it("exposes adminBroadcast and syncCollection from the app sync registry", async () => {
    clearSyncRegistry();
    registerSync({
      config: {adminBroadcast: true, scope: {type: "owner"}},
      model: ConfigSyncMetaTodoModel,
      options: syncOptions,
      routePath: "/todos",
    });
    const agent = await authAsUser(buildApp(), "admin");
    const res = await agent.get("/admin/config").expect(200);
    const todoMeta = (res.body.models as Record<string, unknown>[]).find(
      (model) => model.name === "ConfigSyncMetaTodo"
    );
    assert.isDefined(todoMeta);
    assert.strictEqual(todoMeta?.adminBroadcast, true);
    assert.strictEqual(todoMeta?.syncCollection, "todos");
  });
});
