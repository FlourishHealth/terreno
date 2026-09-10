/**
 * Task 1.5 characterization goldens: pin today's admin REST membership contract
 * (config shape, list query/pagination, search URL, bulk-patch URL/body) for a
 * String `_id` model (Todo-like) and an ObjectId model (User).
 */
import {afterEach, beforeEach, describe, it} from "bun:test";
import {
  addAuthRoutes,
  apiErrorMiddleware,
  apiUnauthorizedMiddleware,
  createdUpdatedPlugin,
  setupAuth,
  type UserModel as UserModelType,
} from "@terreno/api";
import {authAsUser, getBaseServer, setupDb, UserModel} from "@terreno/api/testing";
import {assert} from "chai";
import type express from "express";
import mongoose from "mongoose";
import type TestAgent from "supertest/lib/agent";

import type {AdminModelConfig} from "./adminApp";
import {AdminApp} from "./adminApp";
import {ADMIN_LIST_SEARCH_PARAM} from "./adminTextSearch";
import {ADMIN_SCHEMA_VERSION, MAX_BULK_PATCH_IDS} from "./adminUiV2";

const ADMIN_CONFIG_TOP_KEYS = [
  "capabilities",
  "customScreens",
  "home",
  "models",
  "platformTools",
  "schemaVersion",
  "scripts",
  "widgetIds",
];

const ADMIN_CONFIG_CAPABILITY_KEYS = ["actions", "fieldsets", "filters", "realtime"];

const ADMIN_MODEL_META_ALLOWED_KEYS = new Set([
  "actions",
  "adminBroadcast",
  "bulkPatchAllowlist",
  "defaultSort",
  "displayName",
  "fieldOrder",
  "fields",
  "fieldsets",
  "filters",
  "group",
  "hiddenFields",
  "listDisplay",
  "listDisplayLinks",
  "listFields",
  "name",
  "pageSize",
  "permissions",
  "readonlyFields",
  "realtime",
  "recordTitleField",
  "routePath",
  "searchFields",
  "sortableFields",
  "syncCollection",
]);

const ADMIN_MODEL_META_REQUIRED_KEYS = [
  "actions",
  "adminBroadcast",
  "bulkPatchAllowlist",
  "defaultSort",
  "displayName",
  "fields",
  "filters",
  "hiddenFields",
  "listDisplay",
  "listDisplayLinks",
  "listFields",
  "name",
  "permissions",
  "readonlyFields",
  "realtime",
  "routePath",
  "searchFields",
  "sortableFields",
];

const LIST_PAGINATION_KEYS = ["data", "limit", "more", "page", "total"];

const SEARCH_ENVELOPE_KEYS = ["data"];

const BULK_PATCH_SUCCESS_KEYS = ["updated"];

// Todo-like String `_id` only. syncPlugin is out of scope for Task 1.5 REST membership goldens.
const goldenTodoSchema = new mongoose.Schema({
  _id: {
    default: (): string => new mongoose.Types.ObjectId().toHexString(),
    description: "Client-minted string id",
    type: String,
  },
  completed: {default: false, description: "Whether the todo is done", type: Boolean},
  title: {description: "Todo title", required: true, type: String},
});
goldenTodoSchema.plugin(createdUpdatedPlugin);

const GoldenTodoModel =
  mongoose.models.AdminHttpGoldenTodo ?? mongoose.model("AdminHttpGoldenTodo", goldenTodoSchema);

const todoModelConfig: AdminModelConfig = {
  displayName: "Todos",
  listFields: ["title", "completed"],
  model: GoldenTodoModel,
  pageSize: 2,
  routePath: "/todos",
};

const userModelConfig: AdminModelConfig = {
  displayName: "Users",
  listFields: ["email", "name"],
  model: UserModel,
  routePath: "/users",
};

const sortedKeys = (value: object): string[] => {
  return Object.keys(value).sort();
};

const assertModelMetaShape = (meta: Record<string, unknown>): void => {
  for (const key of Object.keys(meta)) {
    assert.isTrue(
      ADMIN_MODEL_META_ALLOWED_KEYS.has(key),
      `unexpected GET /admin/config models[] key: ${key}`
    );
  }
  for (const key of ADMIN_MODEL_META_REQUIRED_KEYS) {
    assert.property(meta, key);
  }
};

const buildApp = (models: AdminModelConfig[]): express.Application => {
  const app = getBaseServer();
  setupAuth(app, UserModel as unknown as UserModelType);
  addAuthRoutes(app, UserModel as unknown as UserModelType);
  new AdminApp({basePath: "/admin", models}).register(app);
  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);
  return app;
};

describe("admin HTTP goldens (membership + config)", () => {
  let app: express.Application;
  let adminAgent: TestAgent;

  beforeEach(async () => {
    await setupDb();
    app = buildApp([todoModelConfig, userModelConfig]);
    adminAgent = await authAsUser(app, "admin");
  });

  afterEach(async () => {
    await GoldenTodoModel.deleteMany({});
  });

  it("pins GET /admin/config envelope and model routePaths", async () => {
    const res = await adminAgent.get("/admin/config").expect(200);
    const body = res.body as Record<string, unknown>;

    assert.deepEqual(sortedKeys(body), [...ADMIN_CONFIG_TOP_KEYS].sort());
    assert.strictEqual(ADMIN_SCHEMA_VERSION, 2);
    assert.strictEqual(body.schemaVersion, 2);
    assert.deepEqual(
      sortedKeys(body.capabilities as object),
      [...ADMIN_CONFIG_CAPABILITY_KEYS].sort()
    );
    assert.deepEqual(body.capabilities, {
      actions: true,
      fieldsets: true,
      filters: true,
      realtime: false,
    });

    const models = body.models as Record<string, unknown>[];
    assert.lengthOf(models, 2);
    const todoMeta = models.find((model) => model.routePath === "/admin/todos");
    const userMeta = models.find((model) => model.routePath === "/admin/users");
    assert.isDefined(todoMeta);
    assert.isDefined(userMeta);
    assertModelMetaShape(todoMeta as Record<string, unknown>);
    assertModelMetaShape(userMeta as Record<string, unknown>);

    assert.strictEqual(todoMeta?.name, "AdminHttpGoldenTodo");
    assert.deepEqual(todoMeta?.listFields, ["title", "completed"]);
    assert.strictEqual(todoMeta?.pageSize, 2);
    assert.strictEqual(todoMeta?.defaultSort, "-created");
    assert.include(todoMeta?.searchFields as string[], "title");
    const todoFields = todoMeta?.fields as Record<string, {type: string}>;
    assert.strictEqual(todoFields._id.type, "string");
    assert.strictEqual(todoMeta?.adminBroadcast, false);
    assert.notProperty(todoMeta as object, "syncCollection");

    assert.strictEqual(userMeta?.name, "User");
    assert.deepEqual(userMeta?.listFields, ["email", "name"]);
    assert.strictEqual(userMeta?.routePath, "/admin/users");
    const userFields = userMeta?.fields as Record<string, {type: string}>;
    assert.strictEqual(userFields._id.type, "objectid");
  });

  it("pins String-_id list query params and pagination envelope", async () => {
    await GoldenTodoModel.create({_id: "todo-alpha", title: "Alpha task"});
    await GoldenTodoModel.create({_id: "todo-beta", title: "Beta task"});
    await GoldenTodoModel.create({_id: "todo-gamma", title: "Gamma task"});

    const paged = await adminAgent.get("/admin/todos?page=1&limit=2&sort=-created").expect(200);
    assert.deepEqual(sortedKeys(paged.body), [...LIST_PAGINATION_KEYS].sort());
    assert.strictEqual(paged.body.limit, 2);
    assert.strictEqual(paged.body.more, true);
    assert.strictEqual(paged.body.page, "1");
    assert.strictEqual(paged.body.total, 3);
    assert.lengthOf(paged.body.data, 2);
    assert.strictEqual(typeof paged.body.data[0]._id, "string");
    assert.match(paged.body.data[0]._id, /^todo-/);

    const searched = await adminAgent.get("/admin/todos?q=Alpha").expect(200);
    assert.strictEqual(ADMIN_LIST_SEARCH_PARAM, "q");
    assert.lengthOf(searched.body.data, 1);
    assert.strictEqual(searched.body.data[0].title, "Alpha task");
    assert.strictEqual(searched.body.data[0]._id, "todo-alpha");
    assert.strictEqual(searched.body.limit, 2);
    assert.strictEqual(searched.body.more, false);
    assert.strictEqual(searched.body.total, 1);
  });

  it("pins ObjectId User list query params and pagination envelope", async () => {
    const paged = await adminAgent.get("/admin/users?page=1&limit=1&sort=-created").expect(200);
    assert.deepEqual(sortedKeys(paged.body), [...LIST_PAGINATION_KEYS].sort());
    assert.strictEqual(paged.body.limit, 1);
    assert.strictEqual(paged.body.more, true);
    assert.strictEqual(paged.body.page, "1");
    assert.isAtLeast(paged.body.total, 3);
    assert.lengthOf(paged.body.data, 1);
    assert.strictEqual(typeof paged.body.data[0]._id, "string");
    assert.match(paged.body.data[0]._id, /^[a-f0-9]{24}$/);

    const searched = await adminAgent.get("/admin/users?q=notAdmin").expect(200);
    assert.lengthOf(searched.body.data, 1);
    assert.strictEqual(searched.body.data[0].email, "notAdmin@example.com");
    assert.strictEqual(searched.body.limit, 100);
    assert.strictEqual(searched.body.more, false);
    assert.strictEqual(searched.body.total, 1);
  });

  it("pins GET .../search URL, q param, and {data} envelope for both id types", async () => {
    await GoldenTodoModel.create({_id: "todo-search", title: "FindMe later"});

    const todoSearch = await adminAgent.get("/admin/todos/search?q=FindMe").expect(200);
    assert.deepEqual(sortedKeys(todoSearch.body), SEARCH_ENVELOPE_KEYS);
    assert.lengthOf(todoSearch.body.data, 1);
    assert.strictEqual(todoSearch.body.data[0]._id, "todo-search");

    const emptyQ = await adminAgent.get("/admin/todos/search").expect(200);
    assert.deepEqual(emptyQ.body, {data: []});

    const userSearch = await adminAgent.get("/admin/users/search?q=notAdmin").expect(200);
    assert.deepEqual(sortedKeys(userSearch.body), SEARCH_ENVELOPE_KEYS);
    assert.lengthOf(userSearch.body.data, 1);
    assert.strictEqual(userSearch.body.data[0].email, "notAdmin@example.com");
  });

  it("pins POST .../bulk-patch URL and {ids, patch} body for both id types", async () => {
    const a = await GoldenTodoModel.create({
      _id: new mongoose.Types.ObjectId().toHexString(),
      completed: false,
      title: "A",
    });
    const b = await GoldenTodoModel.create({
      _id: new mongoose.Types.ObjectId().toHexString(),
      completed: false,
      title: "B",
    });

    const todoPatch = await adminAgent
      .post("/admin/todos/bulk-patch")
      .send({
        ids: [String(a._id), String(b._id)],
        patch: {completed: true},
      })
      .expect(200);
    assert.deepEqual(sortedKeys(todoPatch.body), BULK_PATCH_SUCCESS_KEYS);
    assert.strictEqual(todoPatch.body.updated, 2);
    assert.isUndefined(todoPatch.body.failures);

    const invalidStringId = await adminAgent
      .post("/admin/todos/bulk-patch")
      .send({
        ids: ["todo-not-an-objectid"],
        patch: {completed: true},
      })
      .expect(200);
    assert.deepEqual(invalidStringId.body, {
      failures: [{id: "todo-not-an-objectid", title: "Invalid id"}],
      updated: 0,
    });

    const emptyIds = await adminAgent
      .post("/admin/todos/bulk-patch")
      .send({ids: [], patch: {completed: true}})
      .expect(400);
    assert.include(emptyIds.body.title, "at least one");

    const tooMany = await adminAgent
      .post("/admin/todos/bulk-patch")
      .send({
        ids: Array.from({length: MAX_BULK_PATCH_IDS + 1}, (_, index) => `id-${index}`),
        patch: {completed: true},
      })
      .expect(400);
    assert.include(tooMany.body.title, String(MAX_BULK_PATCH_IDS));

    const target = await UserModel.findOne({email: "notAdmin@example.com"});
    assert.isOk(target);
    const userPatch = await adminAgent
      .post("/admin/users/bulk-patch")
      .send({
        ids: [String(target?._id)],
        patch: {name: "Golden User"},
      })
      .expect(200);
    assert.deepEqual(sortedKeys(userPatch.body), BULK_PATCH_SUCCESS_KEYS);
    assert.strictEqual(userPatch.body.updated, 1);
    const after = await UserModel.findById(target?._id);
    assert.strictEqual(after?.name, "Golden User");
  });
});
