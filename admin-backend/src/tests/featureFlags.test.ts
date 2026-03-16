import {afterAll, beforeAll, beforeEach, describe, expect, it, mock} from "bun:test";
import {Writable} from "node:stream";
import {TerrenoApp} from "@terreno/api";
import type express from "express";
import mongoose, {Schema} from "mongoose";
import passportLocalMongoose from "passport-local-mongoose";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";
import winston from "winston";
import {AdminApp} from "../adminApp";
import {AuditLog} from "../models/auditLog";
import {FeatureFlag} from "../models/featureFlag";
import {featureFlagsPlugin} from "../plugins/featureFlagsPlugin";

// Mock @sentry/bun
mock.module("@sentry/bun", () => {
  const mockFn = (): ReturnType<typeof mock> => mock(() => {});
  const mockScope = {
    setTag: mockFn(),
    setUser: mockFn(),
  };
  return {
    captureException: mockFn(),
    captureMessage: mockFn(),
    getCurrentScope: mock(() => mockScope),
    init: mockFn(),
    isInitialized: mock(() => true),
    setupExpressErrorHandler: mockFn(),
  };
});

// Test user model with featureFlagsPlugin
const testUserSchema = new Schema({
  admin: {default: false, description: "Admin privileges", type: Boolean},
  email: {description: "Email", required: true, type: String, unique: true},
  name: {description: "Name", type: String},
});

const plm =
  typeof passportLocalMongoose === "function"
    ? passportLocalMongoose
    : (passportLocalMongoose as any).default;

testUserSchema.plugin(plm, {usernameField: "email"});
testUserSchema.plugin(featureFlagsPlugin);

const TestUser = mongoose.models.TestFlagUser || mongoose.model("TestFlagUser", testUserSchema);

// Silence logs
const silentTransport = new winston.transports.Stream({
  format: winston.format.simple(),
  stream: new Writable({
    write(_chunk: any, _encoding: any, callback: any) {
      callback();
    },
  }),
});
winston.clear();
winston.add(silentTransport);

let admin: any;
let regularUser: any;
let adminApp: AdminApp;
let app: express.Application;

const createApp = async (flags: any[] = []) => {
  adminApp = new AdminApp({
    flags,
    models: [],
    userModel: TestUser,
  });

  const terraApp = new TerrenoApp({
    skipListen: true,
    userModel: TestUser as any,
  }).register(adminApp);

  return terraApp.build();
};

const authAsAdmin = async (expressApp: express.Application): Promise<TestAgent> => {
  const agent = supertest.agent(expressApp);
  const res = await agent
    .post("/auth/login")
    .send({email: "flagadmin@test.com", password: "adminpass123"})
    .expect(200);
  agent.set("authorization", `Bearer ${res.body.data.token}`);
  return agent;
};

const authAsRegular = async (expressApp: express.Application): Promise<TestAgent> => {
  const agent = supertest.agent(expressApp);
  const res = await agent
    .post("/auth/login")
    .send({email: "flaguser@test.com", password: "userpass123"})
    .expect(200);
  agent.set("authorization", `Bearer ${res.body.data.token}`);
  return agent;
};

beforeAll(async () => {
  await mongoose
    .connect("mongodb://127.0.0.1/terreno-flags-test?connectTimeoutMS=360000")
    .catch(console.error);
});

afterAll(async () => {
  await mongoose.connection.close();
});

beforeEach(async () => {
  process.env.TOKEN_SECRET = "test-secret";
  process.env.TOKEN_ISSUER = "test-issuer";
  process.env.SESSION_SECRET = "test-session";
  process.env.REFRESH_TOKEN_SECRET = "test-refresh";

  await Promise.all([TestUser.deleteMany({}), FeatureFlag.deleteMany({}), AuditLog.deleteMany({})]);

  admin = await TestUser.create({
    admin: true,
    email: "flagadmin@test.com",
    name: "Admin",
  });
  await (admin as any).setPassword("adminpass123");
  await admin.save();

  regularUser = await TestUser.create({
    email: "flaguser@test.com",
    name: "Regular",
  });
  await (regularUser as any).setPassword("userpass123");
  await regularUser.save();
});

describe("FeatureFlag model", () => {
  it("creates a flag with required fields", async () => {
    const flag = await FeatureFlag.create({
      defaultValue: false,
      flagType: "boolean",
      key: "test-flag",
    });
    expect(flag.key).toBe("test-flag");
    expect(flag.flagType).toBe("boolean");
    expect(flag.defaultValue).toBe(false);
    expect(flag.enabled).toBe(false);
    expect(flag.status).toBe("active");
  });

  it("enforces unique key", async () => {
    await FeatureFlag.create({defaultValue: false, flagType: "boolean", key: "unique-key"});
    await expect(
      FeatureFlag.create({defaultValue: true, flagType: "boolean", key: "unique-key"})
    ).rejects.toThrow();
  });

  it("validates flagType enum", async () => {
    await expect(
      FeatureFlag.create({defaultValue: "x", flagType: "number" as any, key: "bad-type"})
    ).rejects.toThrow();
  });
});

describe("featureFlagsPlugin", () => {
  it("adds featureFlags map to user", async () => {
    const user = await TestUser.findById(regularUser._id);
    expect(user.featureFlags).toBeDefined();
    expect(user.featureFlags instanceof Map).toBe(true);
  });

  it("stores and retrieves flag overrides", async () => {
    const user = await TestUser.findById(regularUser._id);
    user.featureFlags.set("my-flag", true);
    await user.save();

    const reloaded = await TestUser.findById(regularUser._id);
    expect(reloaded.featureFlags.get("my-flag")).toBe(true);
  });
});

describe("startup sync", () => {
  it("syncs flags to database on register", async () => {
    const flags = [
      {defaultValue: false, description: "Test flag", flagType: "boolean" as const, key: "flag-a"},
      {defaultValue: "default", flagType: "string" as const, key: "flag-b"},
    ];

    app = await createApp(flags);

    const dbFlags = await FeatureFlag.find({}).sort("key");
    expect(dbFlags).toHaveLength(2);
    expect(dbFlags[0].key).toBe("flag-a");
    expect(dbFlags[1].key).toBe("flag-b");
    expect(dbFlags[0].status).toBe("active");
  });

  it("preserves enabled and globalValue on re-sync", async () => {
    // First sync
    await createApp([{defaultValue: false, flagType: "boolean" as const, key: "persisted-flag"}]);

    // Manually enable and set globalValue
    await FeatureFlag.updateOne(
      {key: "persisted-flag"},
      {$set: {enabled: true, globalValue: true}}
    );

    // Re-sync
    await createApp([{defaultValue: false, flagType: "boolean" as const, key: "persisted-flag"}]);

    const flag = await FeatureFlag.findOne({key: "persisted-flag"});
    expect(flag!.enabled).toBe(true);
    expect(flag!.globalValue).toBe(true);
  });

  it("archives flags no longer in code", async () => {
    await createApp([{defaultValue: false, flagType: "boolean" as const, key: "will-archive"}]);

    // Re-sync without the flag
    await createApp([]);

    const flag = await FeatureFlag.findOne({key: "will-archive"});
    expect(flag!.status).toBe("archived");
  });
});

describe("evaluation API", () => {
  beforeEach(async () => {
    app = await createApp([
      {
        defaultValue: false,
        description: "Boolean flag",
        flagType: "boolean" as const,
        key: "bool-flag",
      },
      {
        defaultValue: "hello",
        description: "String flag",
        flagType: "string" as const,
        key: "str-flag",
      },
    ]);
  });

  it("returns code default when flag is disabled", async () => {
    const result = await adminApp.boolVariation("bool-flag", null, true);
    // Flag is disabled (default), so code-provided default is used
    expect(result).toBe(true);
  });

  it("returns flag defaultValue when enabled", async () => {
    await FeatureFlag.updateOne({key: "bool-flag"}, {$set: {enabled: true}});
    // Refresh cache by re-creating
    app = await createApp([
      {defaultValue: false, flagType: "boolean" as const, key: "bool-flag"},
      {defaultValue: "hello", flagType: "string" as const, key: "str-flag"},
    ]);

    const result = await adminApp.boolVariation("bool-flag", null, true);
    expect(result).toBe(false); // flag's defaultValue
  });

  it("returns globalValue when set and enabled", async () => {
    await FeatureFlag.updateOne({key: "str-flag"}, {$set: {enabled: true, globalValue: "world"}});
    app = await createApp([
      {defaultValue: false, flagType: "boolean" as const, key: "bool-flag"},
      {defaultValue: "hello", flagType: "string" as const, key: "str-flag"},
    ]);

    const result = await adminApp.stringVariation("str-flag", null, "fallback");
    expect(result).toBe("world");
  });

  it("returns user override when set", async () => {
    await FeatureFlag.updateOne({key: "bool-flag"}, {$set: {enabled: true}});
    app = await createApp([
      {defaultValue: false, flagType: "boolean" as const, key: "bool-flag"},
      {defaultValue: "hello", flagType: "string" as const, key: "str-flag"},
    ]);

    const user = await TestUser.findById(regularUser._id);
    user.featureFlags.set("bool-flag", true);
    await user.save();

    const reloaded = await TestUser.findById(regularUser._id);
    const result = await adminApp.boolVariation("bool-flag", reloaded, false);
    expect(result).toBe(true); // user override
  });

  it("allFlags returns all active flag values", async () => {
    await FeatureFlag.updateOne({key: "bool-flag"}, {$set: {enabled: true}});
    app = await createApp([
      {defaultValue: false, flagType: "boolean" as const, key: "bool-flag"},
      {defaultValue: "hello", flagType: "string" as const, key: "str-flag"},
    ]);

    const flags = await adminApp.allFlags(null);
    expect(flags["bool-flag"]).toBe(false); // enabled, default
    expect(flags["str-flag"]).toBe("hello"); // disabled, still returns defaultValue
  });
});

describe("flag API endpoints", () => {
  beforeEach(async () => {
    app = await createApp([
      {
        defaultValue: false,
        description: "Test boolean",
        flagType: "boolean" as const,
        key: "api-flag",
      },
      {
        defaultValue: "test",
        description: "Test string",
        flagType: "string" as const,
        key: "str-api-flag",
      },
    ]);
    // Enable one flag for testing
    await FeatureFlag.updateOne({key: "api-flag"}, {$set: {enabled: true}});
  });

  describe("GET /admin/flags", () => {
    it("returns all flags for admin", async () => {
      const agent = await authAsAdmin(app);
      const res = await agent.get("/admin/flags").expect(200);
      expect(res.body.data).toHaveLength(2);
    });

    it("filters by status", async () => {
      await FeatureFlag.updateOne({key: "str-api-flag"}, {$set: {status: "archived"}});
      const agent = await authAsAdmin(app);
      const res = await agent.get("/admin/flags?status=active").expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].key).toBe("api-flag");
    });

    it("rejects non-admin", async () => {
      const agent = await authAsRegular(app);
      await agent.get("/admin/flags").expect(403);
    });
  });

  describe("GET /admin/flags/me", () => {
    it("returns evaluated flags for authenticated user", async () => {
      const agent = await authAsRegular(app);
      const res = await agent.get("/admin/flags/me").expect(200);
      expect(res.body).toHaveProperty("api-flag");
      expect(res.body).toHaveProperty("str-api-flag");
    });

    it("rejects unauthenticated", async () => {
      await supertest(app).get("/admin/flags/me").expect(401);
    });
  });

  describe("GET /admin/flags/:key", () => {
    it("returns a single flag", async () => {
      const agent = await authAsAdmin(app);
      const res = await agent.get("/admin/flags/api-flag").expect(200);
      expect(res.body.key).toBe("api-flag");
      expect(res.body.flagType).toBe("boolean");
    });

    it("returns 404 for unknown key", async () => {
      const agent = await authAsAdmin(app);
      await agent.get("/admin/flags/nonexistent").expect(404);
    });
  });

  describe("PATCH /admin/flags/:key", () => {
    it("updates enabled status", async () => {
      const agent = await authAsAdmin(app);
      const res = await agent.patch("/admin/flags/api-flag").send({enabled: false}).expect(200);
      expect(res.body.enabled).toBe(false);
    });

    it("updates globalValue", async () => {
      const agent = await authAsAdmin(app);
      const res = await agent
        .patch("/admin/flags/str-api-flag")
        .send({globalValue: "updated"})
        .expect(200);
      expect(res.body.globalValue).toBe("updated");
    });

    it("creates audit log entry", async () => {
      const agent = await authAsAdmin(app);
      await agent.patch("/admin/flags/api-flag").send({enabled: false}).expect(200);

      const logs = await AuditLog.find({resourceKey: "api-flag"});
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].action).toBe("update");
      expect(logs[0].field).toBe("enabled");
    });
  });

  describe("user override endpoints", () => {
    it("PUT sets a user override", async () => {
      const agent = await authAsAdmin(app);
      const res = await agent
        .put(`/admin/flags/api-flag/users/${regularUser._id}`)
        .send({value: true})
        .expect(200);
      expect(res.body.overrideValue).toBe(true);

      // Verify on user document
      const user = await TestUser.findById(regularUser._id);
      expect(user.featureFlags.get("api-flag")).toBe(true);
    });

    it("GET lists users with overrides", async () => {
      // Set an override first
      const user = await TestUser.findById(regularUser._id);
      user.featureFlags.set("api-flag", true);
      await user.save();

      const agent = await authAsAdmin(app);
      const res = await agent.get("/admin/flags/api-flag/users").expect(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].email).toBe("flaguser@test.com");
    });

    it("DELETE removes a user override", async () => {
      // Set an override first
      const user = await TestUser.findById(regularUser._id);
      user.featureFlags.set("api-flag", true);
      await user.save();

      const agent = await authAsAdmin(app);
      await agent.delete(`/admin/flags/api-flag/users/${regularUser._id}`).expect(200);

      const reloaded = await TestUser.findById(regularUser._id);
      expect(reloaded.featureFlags.has("api-flag")).toBe(false);
    });

    it("creates audit log for override changes", async () => {
      const agent = await authAsAdmin(app);
      await agent
        .put(`/admin/flags/api-flag/users/${regularUser._id}`)
        .send({value: true})
        .expect(200);

      const logs = await AuditLog.find({
        action: "set_override",
        resourceKey: "api-flag",
      });
      expect(logs).toHaveLength(1);
      expect(logs[0].targetUserId!.toString()).toBe(regularUser._id.toString());
    });
  });
});

describe("flagged logger", () => {
  it("logs when flag is enabled for user", async () => {
    const {createFlaggedLogger} = await import("../flaggedLogger");

    app = await createApp([{defaultValue: false, flagType: "boolean" as const, key: "debug-log"}]);

    // Enable the flag
    await FeatureFlag.updateOne({key: "debug-log"}, {$set: {enabled: true}});
    // Re-create to refresh cache
    app = await createApp([{defaultValue: false, flagType: "boolean" as const, key: "debug-log"}]);

    // Set user override to true
    const user = await TestUser.findById(regularUser._id);
    user.featureFlags.set("debug-log", true);
    await user.save();

    const flaggedLogger = createFlaggedLogger(adminApp, "debug-log", "WS");
    const reloaded = await TestUser.findById(regularUser._id);

    // Should not throw
    await flaggedLogger.info(reloaded, "test message");
  });

  it("no-ops when flag is disabled", async () => {
    const {createFlaggedLogger} = await import("../flaggedLogger");

    app = await createApp([{defaultValue: false, flagType: "boolean" as const, key: "debug-log"}]);

    const flaggedLogger = createFlaggedLogger(adminApp, "debug-log", "WS");

    // Should not throw and should not log
    await flaggedLogger.info(null, "this should be silent");
  });
});
