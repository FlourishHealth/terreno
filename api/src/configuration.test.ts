import {beforeEach, describe, expect, it} from "bun:test";
import type express from "express";
import mongoose, {Schema} from "mongoose";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {addAuthRoutes, setupAuth} from "./auth";
import {ConfigurationApp} from "./configurationApp";
import {type ConfigurationStatics, configurationPlugin} from "./configurationPlugin";
import {apiErrorMiddleware, apiUnauthorizedMiddleware} from "./errors";
import {createdUpdatedPlugin} from "./plugins";
import {authAsUser, getBaseServer, setupDb, UserModel} from "./tests";

// -- Test configuration model --

const generalSchema = new Schema(
  {
    appName: {
      default: "Test App",
      description: "Display name of the application",
      type: String,
    },
    maintenanceMode: {
      default: false,
      description: "Enable maintenance mode",
      type: Boolean,
    },
  },
  {_id: false}
);

const integrationsSchema = new Schema(
  {
    apiKey: {
      default: "",
      description: "External API key",
      secret: true,
      secretName: "external-api-key",
      type: String,
    },
    webhookUrl: {
      default: "https://example.com/hook",
      description: "Webhook URL",
      type: String,
    },
  },
  {_id: false}
);

interface TestConfigDocument {
  general: {appName: string; maintenanceMode: boolean};
  integrations: {apiKey: string; webhookUrl: string};
}

const testConfigSchema = new Schema<TestConfigDocument>(
  {
    general: {description: "General settings", type: generalSchema},
    integrations: {description: "Integration settings", type: integrationsSchema},
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

testConfigSchema.plugin(configurationPlugin);
testConfigSchema.plugin(createdUpdatedPlugin);

const TestConfig = (mongoose.models.TestConfig ||
  mongoose.model("TestConfig", testConfigSchema)) as mongoose.Model<any> &
  ConfigurationStatics<TestConfigDocument>;

// -- Test model with top-level scalar fields --

const scalarConfigSchema = new Schema(
  {
    debugMode: {default: false, description: "Enable debug", type: Boolean},
    siteName: {default: "My Site", description: "Site name", type: String},
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);
scalarConfigSchema.plugin(configurationPlugin);
scalarConfigSchema.plugin(createdUpdatedPlugin);

const ScalarConfig = (mongoose.models.ScalarConfig ||
  mongoose.model("ScalarConfig", scalarConfigSchema)) as mongoose.Model<any> &
  ConfigurationStatics<any>;

// -- Helpers --

const buildApp = (
  configModel: mongoose.Model<any>,
  options?: {basePath?: string; fieldOverrides?: Record<string, {widget?: string}>}
): express.Application => {
  const app = getBaseServer();
  setupAuth(app, UserModel as any);
  addAuthRoutes(app, UserModel as any);

  const configApp = new ConfigurationApp({
    basePath: options?.basePath,
    fieldOverrides: options?.fieldOverrides,
    model: configModel,
  });
  configApp.register(app);

  app.use(apiUnauthorizedMiddleware);
  app.use(apiErrorMiddleware);
  return app;
};

// -- Tests --

describe("configurationPlugin", () => {
  beforeEach(async () => {
    // Direct MongoDB collection delete to bypass plugin hooks
    await mongoose.connection.db?.collection("testconfigs").deleteMany({});
    await mongoose.connection.db?.collection("scalarconfigs").deleteMany({});
  });

  describe("getConfig", () => {
    it("creates a default document when none exists", async () => {
      const config = await TestConfig.getConfig();
      expect(config).toBeDefined();
      expect(config.general.appName).toBe("Test App");
      expect(config.general.maintenanceMode).toBe(false);
    });

    it("returns existing document on subsequent calls", async () => {
      const first = await TestConfig.getConfig();
      const second = await TestConfig.getConfig();
      expect(first._id.toString()).toBe(second._id.toString());
    });
  });

  describe("updateConfig", () => {
    it("creates and sets values when no document exists", async () => {
      const config = await TestConfig.updateConfig({
        general: {appName: "Updated", maintenanceMode: false},
      });
      expect(config.general.appName).toBe("Updated");
    });

    it("updates existing document", async () => {
      await TestConfig.getConfig();
      const updated = await TestConfig.updateConfig({
        general: {appName: "Changed", maintenanceMode: true},
      });
      expect(updated.general.appName).toBe("Changed");
      expect(updated.general.maintenanceMode).toBe(true);
    });
  });

  describe("singleton enforcement", () => {
    it("prevents creating a second document via save", async () => {
      await TestConfig.getConfig();
      try {
        await TestConfig.create({});
        throw new Error("Should have thrown");
      } catch (error: any) {
        expect(error.title || error.message).toInclude("Only one configuration document");
      }
    });
  });

  describe("hard delete prevention", () => {
    it("blocks deleteOne", async () => {
      await TestConfig.getConfig();
      try {
        await TestConfig.deleteOne({});
        throw new Error("Should have thrown");
      } catch (error: any) {
        expect(error.title || error.message).toInclude("Cannot hard-delete");
      }
    });

    it("blocks deleteMany", async () => {
      await TestConfig.getConfig();
      try {
        await TestConfig.deleteMany({});
        throw new Error("Should have thrown");
      } catch (error: any) {
        expect(error.title || error.message).toInclude("Cannot hard-delete");
      }
    });

    it("blocks findOneAndDelete", async () => {
      await TestConfig.getConfig();
      try {
        await TestConfig.findOneAndDelete({});
        throw new Error("Should have thrown");
      } catch (error: any) {
        expect(error.title || error.message).toInclude("Cannot hard-delete");
      }
    });
  });

  describe("getSecretFields", () => {
    it("discovers secret fields from nested schemas", () => {
      const secrets = TestConfig.getSecretFields();
      expect(secrets).toHaveLength(1);
      expect(secrets[0].path).toBe("integrations.apiKey");
      expect(secrets[0].secretName).toBe("external-api-key");
    });

    it("returns empty array when no secrets", () => {
      const secrets = ScalarConfig.getSecretFields();
      expect(secrets).toHaveLength(0);
    });
  });

  describe("resolveSecrets", () => {
    it("resolves secrets from a provider", async () => {
      const provider = {
        getSecret: async (name: string) => (name === "external-api-key" ? "resolved-key" : null),
        name: "test-provider",
      };
      const resolved = await TestConfig.resolveSecrets(provider);
      expect(resolved.get("integrations.apiKey")).toBe("resolved-key");
    });

    it("handles provider failures gracefully", async () => {
      const provider = {
        getSecret: async () => {
          throw new Error("Provider down");
        },
        name: "failing-provider",
      };
      const resolved = await TestConfig.resolveSecrets(provider);
      expect(resolved.size).toBe(0);
    });
  });
});

describe("ConfigurationApp routes", () => {
  let app: express.Application;
  let adminAgent: TestAgent;
  let notAdminAgent: TestAgent;

  beforeEach(async () => {
    await setupDb();
    await mongoose.connection.db?.collection("testconfigs").deleteMany({});
    app = buildApp(TestConfig);
    adminAgent = await authAsUser(app, "admin");
    notAdminAgent = await authAsUser(app, "notAdmin");
  });

  describe("GET /configuration/meta", () => {
    it("returns schema metadata for admin", async () => {
      const res = await adminAgent.get("/configuration/meta").expect(200);
      expect(res.body.sections).toBeDefined();
      expect(res.body.sections.length).toBeGreaterThan(0);

      const generalSection = res.body.sections.find((s: any) => s.name === "general");
      expect(generalSection).toBeDefined();
      expect(generalSection.fields.appName).toBeDefined();
      expect(generalSection.fields.appName.type).toBe("string");
    });

    it("marks secret fields in metadata", async () => {
      const res = await adminAgent.get("/configuration/meta").expect(200);
      const intSection = res.body.sections.find((s: any) => s.name === "integrations");
      expect(intSection.fields.apiKey.secret).toBe(true);
      expect(intSection.fields.webhookUrl.secret).toBeFalsy();
    });

    it("returns 403 for non-admin", async () => {
      await notAdminAgent.get("/configuration/meta").expect(403);
    });

    it("returns 401 for unauthenticated user", async () => {
      await supertest(app).get("/configuration/meta").expect(401);
    });
  });

  describe("GET /configuration", () => {
    it("returns config values with defaults", async () => {
      const res = await adminAgent.get("/configuration").expect(200);
      expect(res.body.data.general.appName).toBe("Test App");
      expect(res.body.data.general.maintenanceMode).toBe(false);
    });

    it("redacts secret fields", async () => {
      // Set a secret value first
      await (TestConfig as any).updateConfig({integrations: {apiKey: "super-secret-key"}});
      const res = await adminAgent.get("/configuration").expect(200);
      expect(res.body.data.integrations.apiKey).toBe("********");
      expect(res.body.data.integrations.webhookUrl).toBe("https://example.com/hook");
    });

    it("does not redact empty secret fields", async () => {
      const res = await adminAgent.get("/configuration").expect(200);
      // Empty string should not be redacted
      expect(res.body.data.integrations.apiKey).toBe("");
    });

    it("returns 403 for non-admin", async () => {
      await notAdminAgent.get("/configuration").expect(403);
    });
  });

  describe("PATCH /configuration", () => {
    it("updates configuration values", async () => {
      const res = await adminAgent
        .patch("/configuration")
        .send({general: {appName: "New Name"}})
        .expect(200);
      expect(res.body.data.general.appName).toBe("New Name");
    });

    it("redacts secrets in the response", async () => {
      const res = await adminAgent
        .patch("/configuration")
        .send({integrations: {apiKey: "new-secret"}})
        .expect(200);
      expect(res.body.data.integrations.apiKey).toBe("********");
    });

    it("returns 403 for non-admin", async () => {
      await notAdminAgent
        .patch("/configuration")
        .send({general: {appName: "Hack"}})
        .expect(403);
    });
  });

  describe("POST /configuration/list-secrets", () => {
    it("returns discovered secret fields", async () => {
      const res = await adminAgent.post("/configuration/list-secrets").expect(200);
      expect(res.body.secretFields).toHaveLength(1);
      expect(res.body.secretFields[0].path).toBe("integrations.apiKey");
      expect(res.body.secretFields[0].secretName).toBe("external-api-key");
    });

    it("returns 403 for non-admin", async () => {
      await notAdminAgent.post("/configuration/list-secrets").expect(403);
    });
  });
});

describe("ConfigurationApp with scalar fields", () => {
  let app: express.Application;
  let adminAgent: TestAgent;

  beforeEach(async () => {
    await setupDb();
    await mongoose.connection.db?.collection("scalarconfigs").deleteMany({});
    app = buildApp(ScalarConfig);
    adminAgent = await authAsUser(app, "admin");
  });

  it("puts scalar fields into __root__ section", async () => {
    const res = await adminAgent.get("/configuration/meta").expect(200);
    const rootSection = res.body.sections.find((s: any) => s.name === "__root__");
    expect(rootSection).toBeDefined();
    expect(rootSection.displayName).toBe("General");
    expect(rootSection.fields.siteName).toBeDefined();
    expect(rootSection.fields.debugMode).toBeDefined();
  });
});

describe("ConfigurationApp with field overrides", () => {
  let app: express.Application;
  let adminAgent: TestAgent;

  beforeEach(async () => {
    await setupDb();
    await mongoose.connection.db?.collection("testconfigs").deleteMany({});
    app = buildApp(TestConfig, {
      fieldOverrides: {"integrations.webhookUrl": {widget: "url"}},
    });
    adminAgent = await authAsUser(app, "admin");
  });

  it("applies widget overrides to metadata", async () => {
    const res = await adminAgent.get("/configuration/meta").expect(200);
    const intSection = res.body.sections.find((s: any) => s.name === "integrations");
    expect(intSection.fields.webhookUrl.widget).toBe("url");
  });
});
