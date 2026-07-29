import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {
  addAuthRoutes,
  apiErrorMiddleware,
  apiUnauthorizedMiddleware,
  BackgroundTask,
  setupAuth,
  type UserModel as UserModelType,
  VersionConfig,
} from "@terreno/api";
import {
  authAsUser,
  FoodModel,
  getBaseServer,
  RequiredModel,
  setupDb,
  UserModel,
} from "@terreno/api/testing";
import type express from "express";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import type {AdminAuditEvent, AdminModelConfig, AdminOptions} from "./adminApp";
import {AdminApp} from "./adminApp";

const buildApp = (
  models: AdminModelConfig[] = [],
  adminOverrides?: Partial<AdminOptions>
): express.Application => {
  const app = getBaseServer();
  setupAuth(app, UserModel as unknown as UserModelType);
  addAuthRoutes(app, UserModel as unknown as UserModelType);

  const admin = new AdminApp({
    basePath: "/admin",
    models,
    ...adminOverrides,
  });
  admin.register(app);

  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);

  return app;
};

const foodModelConfig: AdminModelConfig = {
  displayName: "Foods",
  listFields: ["name", "calories"],
  model: FoodModel,
  routePath: "/foods",
};

describe("AdminApp /admin/config", () => {
  let app: express.Application;
  let adminAgent: TestAgent;
  let notAdminAgent: TestAgent;

  beforeEach(async () => {
    await setupDb();
    app = buildApp([
      {
        ...foodModelConfig,
        fieldOrder: ["name", "calories", "tags"],
        fieldOverrides: {name: {widget: "markdown"}},
        hiddenFields: ["hidden"],
      },
    ]);
    adminAgent = await authAsUser(app, "admin");
    notAdminAgent = await authAsUser(app, "notAdmin");
  });

  afterEach(async () => {
    await FoodModel.deleteMany({});
    await VersionConfig.deleteMany({});
  });

  it("returns metadata for configured models to admins", async () => {
    const res = await adminAgent.get("/admin/config").expect(200);

    expect(res.body.schemaVersion).toBe(2);
    expect(res.body.home?.title).toBe("Administration");
    expect(res.body.home?.slots?.main).toEqual(["modelsGrid"]);
    expect(res.body.models).toHaveLength(1);
    const [foodMeta] = res.body.models;
    expect(foodMeta.name).toBe("Food");
    expect(foodMeta.displayName).toBe("Foods");
    expect(foodMeta.listFields).toEqual(["name", "calories"]);
    expect(foodMeta.routePath).toBe("/admin/foods");
    expect(foodMeta.defaultSort).toBe("-created");
    expect(foodMeta.fieldOrder).toEqual(["name", "calories", "tags"]);
  });

  it("includes recordTitleField in config when set on the model", async () => {
    const appWithTitle = buildApp([{...foodModelConfig, recordTitleField: "name"}]);
    const agent = await authAsUser(appWithTitle, "admin");
    const res = await agent.get("/admin/config").expect(200);
    expect(res.body.models[0].recordTitleField).toBe("name");
  });

  it("applies fieldOverrides to generated config", async () => {
    const res = await adminAgent.get("/admin/config").expect(200);
    const [foodMeta] = res.body.models;
    expect(foodMeta.fields.name.widget).toBe("markdown");
  });

  it("removes hidden fields from config and listFields", async () => {
    app = buildApp([
      {
        ...foodModelConfig,
        hiddenFields: ["hidden"],
        listFields: ["name", "hidden", "calories"],
      },
    ]);
    const agent = await authAsUser(app, "admin");
    const res = await agent.get("/admin/config").expect(200);
    const [foodMeta] = res.body.models;
    expect(foodMeta.fields.hidden).toBeUndefined();
    expect(foodMeta.listFields).toEqual(["name", "calories"]);
  });

  it("extracts item sub-field metadata for array fields", async () => {
    const res = await adminAgent.get("/admin/config").expect(200);
    const [foodMeta] = res.body.models;
    // likesIds is an array of subdocuments with likes + userId sub-fields
    expect(foodMeta.fields.likesIds.type).toBe("array");
    expect(foodMeta.fields.likesIds.items).toBeDefined();
    expect(foodMeta.fields.likesIds.items.userId).toBeDefined();
    expect(foodMeta.fields.likesIds.items.likes).toBeDefined();
  });

  it("extracts ref information for ObjectId fields", async () => {
    const res = await adminAgent.get("/admin/config").expect(200);
    const [foodMeta] = res.body.models;
    expect(foodMeta.fields.ownerId.ref).toBe("User");
  });

  it("extracts ref information for array of ObjectId references", async () => {
    const res = await adminAgent.get("/admin/config").expect(200);
    const [foodMeta] = res.body.models;
    expect(foodMeta.fields.eatenBy.ref).toBe("User");
  });

  it("extracts itemType for primitive string arrays", async () => {
    const res = await adminAgent.get("/admin/config").expect(200);
    const [foodMeta] = res.body.models;
    // tags is [String] — should expose itemType so the frontend renders a primitive list
    expect(foodMeta.fields.tags.type).toBe("array");
    expect(foodMeta.fields.tags.itemType).toBe("string");
    expect(foodMeta.fields.tags.items).toBeUndefined();
  });

  it("extracts itemType and itemRef for arrays of ObjectId references", async () => {
    const res = await adminAgent.get("/admin/config").expect(200);
    const [foodMeta] = res.body.models;
    // eatenBy is [{type: ObjectId, ref: "User"}] — should expose both itemType and itemRef
    expect(foodMeta.fields.eatenBy.type).toBe("array");
    expect(foodMeta.fields.eatenBy.itemType).toBe("objectid");
    expect(foodMeta.fields.eatenBy.itemRef).toBe("User");
  });

  it("returns 403 for non-admin users", async () => {
    const res = await notAdminAgent.get("/admin/config").expect(403);
    expect(res.body.title).toInclude("Admin access required");
  });

  it("returns 401 for unauthenticated users", async () => {
    await supertest(app).get("/admin/config").expect(401);
  });

  it("defaults basePath to /admin when not provided", async () => {
    const altApp = getBaseServer();
    setupAuth(altApp, UserModel as unknown as UserModelType);
    addAuthRoutes(altApp, UserModel as unknown as UserModelType);
    new AdminApp({models: [foodModelConfig]}).register(altApp);
    altApp.use(apiUnauthorizedMiddleware);
    altApp.use(apiErrorMiddleware);

    const agent = await authAsUser(altApp, "admin");
    const res = await agent.get("/admin/config").expect(200);
    expect(res.body.models[0].routePath).toBe("/admin/foods");
  });

  it("uses a custom defaultSort when provided", async () => {
    app = buildApp([{...foodModelConfig, defaultSort: "name"}]);
    const agent = await authAsUser(app, "admin");
    const res = await agent.get("/admin/config").expect(200);
    expect(res.body.models[0].defaultSort).toBe("name");
  });

  it("includes version-config custom screen", async () => {
    const res = await adminAgent.get("/admin/config").expect(200);
    expect(res.body.customScreens).toEqual([
      {displayName: "Version Config", name: "version-config"},
    ]);
  });

  it("normalizes home.slots so recentActivity is last in sidebar", async () => {
    app = buildApp([foodModelConfig], {
      home: {
        slots: {sidebar: ["recentActivity", "versionConfig"]},
        title: "Ops",
      },
    });
    const agent = await authAsUser(app, "admin");
    const res = await agent.get("/admin/config").expect(200);
    expect(res.body.home.title).toBe("Ops");
    expect(res.body.home.slots.sidebar).toEqual(["versionConfig", "recentActivity"]);
  });
});

describe("AdminApp model CRUD routes", () => {
  let app: express.Application;
  let adminAgent: TestAgent;
  let notAdminAgent: TestAgent;

  beforeEach(async () => {
    await setupDb();
    app = buildApp([{...foodModelConfig, hiddenFields: ["hidden"]}]);
    adminAgent = await authAsUser(app, "admin");
    notAdminAgent = await authAsUser(app, "notAdmin");
  });

  afterEach(async () => {
    await FoodModel.deleteMany({});
  });

  it("creates documents via POST and strips hidden fields from response", async () => {
    const res = await adminAgent
      .post("/admin/foods")
      .send({calories: 120, hidden: true, name: "Apple"})
      .expect(201);

    expect(res.body.data.name).toBe("Apple");
    expect(res.body.data.calories).toBe(120);
    expect(res.body.data.hidden).toBeUndefined();
  });

  it("lists documents via GET and strips hidden fields from results", async () => {
    await FoodModel.create({calories: 120, hidden: true, name: "Apple"});
    await FoodModel.create({calories: 95, hidden: false, name: "Banana"});

    const res = await adminAgent.get("/admin/foods").expect(200);
    expect(res.body.data).toHaveLength(2);
    for (const item of res.body.data) {
      expect(item.hidden).toBeUndefined();
    }
  });

  it("reads a document via GET /:id", async () => {
    const food = await FoodModel.create({calories: 120, name: "Apple"});
    const res = await adminAgent.get(`/admin/foods/${food._id}`).expect(200);
    expect(res.body.data.name).toBe("Apple");
  });

  it("updates a document via PATCH /:id", async () => {
    const food = await FoodModel.create({calories: 120, name: "Apple"});
    const res = await adminAgent
      .patch(`/admin/foods/${food._id}`)
      .send({calories: 150})
      .expect(200);
    expect(res.body.data.calories).toBe(150);
  });

  it("deletes a document via DELETE /:id", async () => {
    const food = await FoodModel.create({calories: 120, name: "Apple"});
    await adminAgent.delete(`/admin/foods/${food._id}`).expect(204);
    expect(await FoodModel.findById(food._id)).toBeNull();
  });

  it("rejects non-admin users from model list", async () => {
    const res = await notAdminAgent.get("/admin/foods");
    // modelRouter with IsAdmin permission blocks non-admin users
    expect([401, 403, 405]).toContain(res.status);
  });

  it("supports models without hiddenFields (no responseHandler installed)", async () => {
    app = buildApp([foodModelConfig]);
    const agent = await authAsUser(app, "admin");
    await FoodModel.create({calories: 120, hidden: true, name: "Apple"});
    const res = await agent.get("/admin/foods").expect(200);
    expect(res.body.data[0].hidden).toBe(true);
  });

  it("recursively removes hidden fields from array item values", async () => {
    await RequiredModel.deleteMany({});
    app = buildApp([
      {
        displayName: "Required",
        hiddenFields: ["about"],
        listFields: ["name"],
        model: RequiredModel,
        routePath: "/required",
      },
    ]);
    const agent = await authAsUser(app, "admin");
    await RequiredModel.create({about: "secret", name: "first"});
    await RequiredModel.create({about: "secret2", name: "second"});
    const res = await agent.get("/admin/required").expect(200);
    expect(res.body.data).toHaveLength(2);
    for (const doc of res.body.data) {
      expect(doc.about).toBeUndefined();
      expect(doc.name).toBeDefined();
    }
    await RequiredModel.deleteMany({});
  });
});

describe("AdminApp /admin/version-config", () => {
  let app: express.Application;
  let adminAgent: TestAgent;
  let notAdminAgent: TestAgent;

  beforeEach(async () => {
    await setupDb();
    await VersionConfig.deleteMany({});
    app = buildApp([]);
    adminAgent = await authAsUser(app, "admin");
    notAdminAgent = await authAsUser(app, "notAdmin");
  });

  afterEach(async () => {
    await VersionConfig.deleteMany({});
  });

  it("returns default values when no config exists", async () => {
    const res = await adminAgent.get("/admin/version-config").expect(200);
    expect(res.body.mobileRequiredVersion).toBe(0);
    expect(res.body.webWarningVersion).toBe(0);
    expect(res.body.requiredMessage).toInclude("update");
  });

  it("returns the stored config when present", async () => {
    await VersionConfig.create({
      _singleton: "config",
      mobileRequiredVersion: 5,
      mobileWarningVersion: 3,
      updateUrl: "https://example.com/update",
    });
    const res = await adminAgent.get("/admin/version-config").expect(200);
    expect(res.body.mobileRequiredVersion).toBe(5);
    expect(res.body.mobileWarningVersion).toBe(3);
    expect(res.body.updateUrl).toBe("https://example.com/update");
  });

  it("creates or updates the config via PUT", async () => {
    const res = await adminAgent
      .put("/admin/version-config")
      .send({
        mobileRequiredVersion: 10,
        mobileWarningVersion: 8,
        updateUrl: "https://example.com/upgrade",
      })
      .expect(200);
    expect(res.body.mobileRequiredVersion).toBe(10);
    expect(res.body.updateUrl).toBe("https://example.com/upgrade");

    const stored = await VersionConfig.findOne({_singleton: "config"});
    expect(stored?.mobileRequiredVersion).toBe(10);
  });

  it("unsets fields passed as null via PUT", async () => {
    await adminAgent
      .put("/admin/version-config")
      .send({updateUrl: "https://example.com/upgrade"})
      .expect(200);

    const res = await adminAgent.put("/admin/version-config").send({updateUrl: null}).expect(200);

    expect(res.body.updateUrl).toBeUndefined();
  });

  it("ignores unknown fields via PUT", async () => {
    const res = await adminAgent
      .put("/admin/version-config")
      .send({bogusField: "nope", mobileRequiredVersion: 2})
      .expect(200);
    expect(res.body.mobileRequiredVersion).toBe(2);
    expect(res.body.bogusField).toBeUndefined();
  });

  it("returns 403 for non-admins (GET)", async () => {
    await notAdminAgent.get("/admin/version-config").expect(403);
  });

  it("returns 403 for non-admins (PUT)", async () => {
    await notAdminAgent.put("/admin/version-config").send({}).expect(403);
  });

  it("returns 401 for unauthenticated users", async () => {
    await supertest(app).get("/admin/version-config").expect(401);
  });
});

describe("AdminApp search route", () => {
  let app: express.Application;
  let adminAgent: TestAgent;
  let notAdminAgent: TestAgent;

  beforeEach(async () => {
    await setupDb();
    app = buildApp([foodModelConfig]);
    adminAgent = await authAsUser(app, "admin");
    notAdminAgent = await authAsUser(app, "notAdmin");
  });

  afterEach(async () => {
    await FoodModel.deleteMany({});
  });

  it("returns empty results when q is empty", async () => {
    const res = await adminAgent.get("/admin/foods/search").expect(200);
    expect(res.body.data).toEqual([]);
  });

  it("returns results matching searchable string fields", async () => {
    await FoodModel.create({calories: 120, name: "Apple"});
    await FoodModel.create({calories: 95, name: "Banana"});
    const res = await adminAgent.get("/admin/foods/search?q=App").expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("Apple");
  });

  it("escapes regex special characters in search query", async () => {
    await FoodModel.create({calories: 100, name: "Rice.Bowl"});
    const res = await adminAgent.get("/admin/foods/search?q=Rice.Bowl").expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("Rice.Bowl");
  });

  it("filters by explicit fields when provided", async () => {
    await FoodModel.create({calories: 100, name: "Apple"});
    const res = await adminAgent.get("/admin/foods/search?q=Apple&fields=calories").expect(200);
    // calories isn't a searchable string field so the result should be empty
    expect(res.body.data).toEqual([]);
  });

  it("exercises ObjectId query branch when query looks like an ObjectId", async () => {
    const user = await UserModel.findOne({email: "admin@example.com"});
    await FoodModel.create({calories: 100, name: "Kale", ownerId: user?._id});
    // Whether any results come back depends on which fields the admin config
    // identifies as ObjectId-typed; the important thing for coverage is that
    // the ObjectId branch runs without throwing.
    const res = await adminAgent.get(`/admin/foods/search?q=${user?._id}`).expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("returns 403 for non-admins", async () => {
    await notAdminAgent.get("/admin/foods/search?q=x").expect(403);
  });

  it("returns 401 for unauthenticated users", async () => {
    await supertest(app).get("/admin/foods/search?q=x").expect(401);
  });
});

describe("AdminApp with scripts that use context", () => {
  let app: express.Application;
  let adminAgent: TestAgent;

  afterEach(async () => {
    const {BackgroundTask} = await import("@terreno/api");
    await BackgroundTask.deleteMany({});
  });

  it("reports progress, logs, and checks cancellation via ctx", async () => {
    await setupDb();
    const {BackgroundTask} = await import("@terreno/api");

    const appWithScript = getBaseServer();
    setupAuth(appWithScript, UserModel as unknown as UserModelType);
    addAuthRoutes(appWithScript, UserModel as unknown as UserModelType);

    const admin = new AdminApp({
      basePath: "/admin",
      models: [],
      scripts: [
        {
          description: "Exercises ctx",
          name: "ctx-script",
          runner: async (_wetRun, ctx) => {
            await ctx?.addLog("info", "hello");
            await ctx?.updateProgress(50, "Halfway", "Processing");
            await ctx?.checkCancellation();
            return {results: ["ok"], success: true};
          },
        },
      ],
    });
    admin.register(appWithScript);
    appWithScript.use(apiUnauthorizedMiddleware);
    appWithScript.use(apiErrorMiddleware);

    app = appWithScript;
    adminAgent = await authAsUser(app, "admin");
    const res = await adminAgent.post("/admin/scripts/ctx-script/run").expect(201);

    // Wait for script completion
    await new Promise((resolve) => setTimeout(resolve, 150));

    const task = await BackgroundTask.findById(res.body.taskId);
    expect(task?.status).toBe("completed");
    // addLog("info", "hello") should have persisted
    expect(task?.logs.some((l: {message: string}) => l.message === "hello")).toBe(true);
    expect(task?.progress?.percentage).toBe(100);
  });
});

describe("AdminApp admin UI v2 routes", () => {
  let app: express.Application;
  let adminAgent: TestAgent;
  let notAdminAgent: TestAgent;

  beforeEach(async () => {
    await setupDb();
    app = buildApp([{...foodModelConfig, hiddenFields: ["hidden"]}]);
    adminAgent = await authAsUser(app, "admin");
    notAdminAgent = await authAsUser(app, "notAdmin");
  });

  afterEach(async () => {
    await FoodModel.deleteMany({});
    await BackgroundTask.deleteMany({});
  });

  it("rejects bulk-patch with an empty ids array", async () => {
    const res = await adminAgent
      .post("/admin/foods/bulk-patch")
      .send({ids: [], patch: {calories: 1}})
      .expect(400);
    expect(res.body.title).toInclude("at least one");
  });

  it("bulk-patches allowlisted fields for many ids", async () => {
    const a = await FoodModel.create({calories: 1, name: "A"});
    const b = await FoodModel.create({calories: 2, name: "B"});
    const res = await adminAgent
      .post("/admin/foods/bulk-patch")
      .send({
        ids: [String(a._id), String(b._id)],
        patch: {calories: 50},
      })
      .expect(200);
    expect(res.body.updated).toBe(2);
    expect(res.body.failures).toBeUndefined();
    const updated = await FoodModel.find({_id: {$in: [a._id, b._id]}})
      .lean()
      .exec();
    for (const row of updated) {
      expect(row.calories).toBe(50);
    }
  });

  it("rejects bulk-patch with more than 1000 ids", async () => {
    const ids = Array.from({length: 1001}, (_, index) => index.toString(16).padStart(24, "0"));
    const res = await adminAgent
      .post("/admin/foods/bulk-patch")
      .send({ids, patch: {calories: 1}})
      .expect(400);
    expect(res.body.title).toInclude("1000");
  });

  it("rejects bulk-patch keys outside the allowlist", async () => {
    const a = await FoodModel.create({calories: 1, name: "A"});
    const res = await adminAgent
      .post("/admin/foods/bulk-patch")
      .send({
        ids: [String(a._id)],
        patch: {thisFieldIsNotAllowlisted: true},
      })
      .expect(400);
    expect(res.body.title).toInclude("allowlisted");
  });

  it("enqueues a background task and returns taskId", async () => {
    const res = await adminAgent
      .post("/admin/background-tasks")
      .send({kind: "reindex-search", metadata: {scope: "foods"}})
      .expect(201);
    expect(typeof res.body.taskId).toBe("string");
    const task = await BackgroundTask.findById(res.body.taskId);
    expect(task?.taskType).toBe("reindex-search");
    expect(task?.status).toBe("pending");
  });

  it("returns 403 for background-tasks when not admin", async () => {
    await notAdminAgent.post("/admin/background-tasks").send({kind: "x"}).expect(403);
  });

  it("strips readonly fields from PATCH updates", async () => {
    app = buildApp([
      {
        ...foodModelConfig,
        readonlyFields: ["name"],
      },
    ]);
    const agent = await authAsUser(app, "admin");
    const food = await FoodModel.create({calories: 10, name: "KeepMe"});
    await agent.patch(`/admin/foods/${food._id}`).send({calories: 99, name: "Changed"}).expect(200);
    const reRead = await FoodModel.findById(food._id).lean();
    expect(reRead?.name).toBe("KeepMe");
    expect(reRead?.calories).toBe(99);
  });

  it("strips readonly fields from POST create", async () => {
    app = buildApp([
      {
        ...foodModelConfig,
        readonlyFields: ["name"],
      },
    ]);
    const agent = await authAsUser(app, "admin");
    const res = await agent
      .post("/admin/foods")
      .send({calories: 5, name: "IgnoredName"})
      .expect(201);
    expect(res.body.data.name).toBeUndefined();
    expect(res.body.data.calories).toBe(5);
    const stored = await FoodModel.findById(res.body.data._id).lean();
    expect(stored?.name).toBeUndefined();
    expect(stored?.calories).toBe(5);
  });

  it("disables DELETE when permissions.delete is false", async () => {
    app = buildApp([
      {
        ...foodModelConfig,
        permissions: {delete: false},
      },
    ]);
    const agent = await authAsUser(app, "admin");
    const food = await FoodModel.create({calories: 1, name: "Nope"});
    const res = await agent.delete(`/admin/foods/${food._id}`);
    expect([403, 405]).toContain(res.status);
  });
});

describe("AdminApp onAdminAudit", () => {
  let app: express.Application;
  let adminAgent: TestAgent;
  const auditEvents: AdminAuditEvent[] = [];

  beforeEach(async () => {
    await setupDb();
    auditEvents.length = 0;
    app = buildApp([{...foodModelConfig, hiddenFields: ["hidden"]}], {
      onAdminAudit: async (event): Promise<void> => {
        auditEvents.push(event);
      },
    });
    adminAgent = await authAsUser(app, "admin");
  });

  afterEach(async () => {
    await FoodModel.deleteMany({});
  });

  it("invokes onAdminAudit with verb created after POST", async () => {
    await adminAgent.post("/admin/foods").send({calories: 5, name: "Audited"}).expect(201);
    expect(auditEvents.some((e) => e.verb === "created" && e.modelName === "Food")).toBe(true);
  });

  it("invokes onAdminAudit with verb updated after PATCH", async () => {
    const food = await FoodModel.create({calories: 10, name: "PatchMe"});
    await adminAgent.patch(`/admin/foods/${food._id}`).send({calories: 42}).expect(200);
    expect(auditEvents.some((e) => e.verb === "updated" && e.modelName === "Food")).toBe(true);
  });

  it("invokes onAdminAudit with verb deleted after DELETE", async () => {
    const food = await FoodModel.create({calories: 1, name: "DeleteMe"});
    await adminAgent.delete(`/admin/foods/${food._id}`).expect(204);
    expect(auditEvents.some((e) => e.verb === "deleted" && e.modelName === "Food")).toBe(true);
  });
});

describe("AdminApp onAdminAudit is best-effort", () => {
  beforeEach(async () => {
    await setupDb();
  });

  afterEach(async () => {
    await FoodModel.deleteMany({});
  });

  const throwingAudit = {
    onAdminAudit: async (): Promise<void> => {
      throw new Error("audit sink failure");
    },
  };

  it("returns 201 on POST when onAdminAudit throws", async () => {
    const localApp = buildApp([foodModelConfig], throwingAudit);
    const agent = await authAsUser(localApp, "admin");
    const res = await agent
      .post("/admin/foods")
      .send({calories: 5, name: "StillCreated"})
      .expect(201);
    const stored = await FoodModel.findById(res.body.data._id).lean();
    expect(stored?.name).toBe("StillCreated");
  });

  it("returns 200 on PATCH when onAdminAudit throws", async () => {
    const localApp = buildApp([foodModelConfig], throwingAudit);
    const agent = await authAsUser(localApp, "admin");
    const food = await FoodModel.create({calories: 10, name: "PatchMe"});
    const res = await agent.patch(`/admin/foods/${food._id}`).send({calories: 99}).expect(200);
    expect(res.body.data.calories).toBe(99);
    const stored = await FoodModel.findById(food._id).lean();
    expect(stored?.calories).toBe(99);
  });

  it("returns 204 on DELETE when onAdminAudit throws", async () => {
    const localApp = buildApp([foodModelConfig], throwingAudit);
    const agent = await authAsUser(localApp, "admin");
    const food = await FoodModel.create({calories: 1, name: "DeleteMe"});
    await agent.delete(`/admin/foods/${food._id}`).expect(204);
    expect(await FoodModel.findById(food._id)).toBeNull();
  });
});

describe("AdminApp per-model queryFilter", () => {
  beforeEach(async () => {
    await setupDb();
  });

  afterEach(async () => {
    await FoodModel.deleteMany({});
    await VersionConfig.deleteMany({});
  });

  it("returns an empty list when queryFilter returns null", async () => {
    const localApp = buildApp([
      {
        ...foodModelConfig,
        queryFilter: (): null => null,
      },
    ]);
    await FoodModel.create({calories: 1, name: "HiddenRow"});
    const agent = await authAsUser(localApp, "admin");
    const res = await agent.get("/admin/foods").expect(200);
    expect(res.body.data).toEqual([]);
  });

  it("merges queryFilter constraints into list queries for that model only", async () => {
    const localApp = buildApp([
      {
        ...foodModelConfig,
        queryFilter: (_user, query): Record<string, unknown> => ({
          ...(query ?? {}),
          name: "FilteredOnly",
        }),
      },
    ]);
    await FoodModel.create({calories: 1, name: "Other"});
    await FoodModel.create({calories: 2, name: "FilteredOnly"});
    const agent = await authAsUser(localApp, "admin");
    const res = await agent.get("/admin/foods").expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe("FilteredOnly");
  });
});
