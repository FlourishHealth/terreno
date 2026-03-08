import {afterAll, beforeAll, beforeEach, describe, expect, it} from "bun:test";
import mongoose, {model, Schema} from "mongoose";
import type {SecretProvider} from "./configurationPlugin";
import {configurationPlugin} from "./configurationPlugin";

// --- Test schema with secret fields ---

interface TestConfig {
  appName: string;
  maintenanceMode: boolean;
  apiKey: string;
  nested: {
    webhookUrl: string;
    secretToken: string;
  };
}

const testConfigSchema = new Schema<TestConfig>({
  apiKey: {
    default: "",
    description: "External API key",
    secret: true,
    secretName: "ext-api-key",
    type: String,
  },
  appName: {
    default: "Test App",
    description: "Application name",
    type: String,
  },
  maintenanceMode: {
    default: false,
    description: "Whether maintenance mode is on",
    type: Boolean,
  },
  nested: {
    type: new Schema({
      secretToken: {
        default: "",
        description: "A nested secret token",
        secret: true,
        secretName: "nested-token",
        secretProvider: "vault",
        type: String,
      },
      webhookUrl: {
        default: "https://example.com/hook",
        description: "Webhook URL",
        type: String,
      },
    }),
  },
});

testConfigSchema.plugin(configurationPlugin);

const TestConfigModel = model("TestConfiguration", testConfigSchema) as any;

// --- Simple schema for singleton tests ---

const simpleSchema = new Schema({
  value: {default: "default", description: "A value", type: String},
});
simpleSchema.plugin(configurationPlugin);
const SimpleConfigModel = model("SimpleConfiguration", simpleSchema) as any;

describe("configurationPlugin", () => {
  describe("schema setup", () => {
    it("adds a _singleton field with unique index", () => {
      const indexes = SimpleConfigModel.schema.indexes();
      const singletonIndex = indexes.find(
        ([fields]: [Record<string, any>]) => fields._singleton !== undefined
      );
      expect(singletonIndex).toBeDefined();
      expect(singletonIndex[1].unique).toBe(true);
    });

    it("adds getConfig static", () => {
      expect(typeof SimpleConfigModel.getConfig).toBe("function");
    });

    it("adds updateConfig static", () => {
      expect(typeof SimpleConfigModel.updateConfig).toBe("function");
    });

    it("adds getSecretFields static", () => {
      expect(typeof TestConfigModel.getSecretFields).toBe("function");
    });

    it("adds resolveSecrets static", () => {
      expect(typeof TestConfigModel.resolveSecrets).toBe("function");
    });
  });

  describe("getSecretFields", () => {
    it("discovers top-level secret fields", () => {
      const secrets = TestConfigModel.getSecretFields();
      const apiKeySecret = secrets.find((s: {path: string}) => s.path === "apiKey");
      expect(apiKeySecret).toBeDefined();
      expect(apiKeySecret.secretName).toBe("ext-api-key");
    });

    it("discovers nested secret fields", () => {
      const secrets = TestConfigModel.getSecretFields();
      const nestedSecret = secrets.find((s: {path: string}) => s.path === "nested.secretToken");
      expect(nestedSecret).toBeDefined();
      expect(nestedSecret.secretName).toBe("nested-token");
      expect(nestedSecret.secretProvider).toBe("vault");
    });

    it("does not include non-secret fields", () => {
      const secrets = TestConfigModel.getSecretFields();
      const nonSecret = secrets.find((s: {path: string}) => s.path === "appName");
      expect(nonSecret).toBeUndefined();
    });

    it("returns the correct total count of secret fields", () => {
      const secrets = TestConfigModel.getSecretFields();
      expect(secrets.length).toBe(2);
    });
  });

  describe("resolveSecrets", () => {
    it("resolves secrets from a provider", async () => {
      const provider: SecretProvider = {
        getSecret: async (name: string) => {
          if (name === "ext-api-key") {
            return "resolved-api-key";
          }
          if (name === "nested-token") {
            return "resolved-token";
          }
          return null;
        },
        name: "test-provider",
      };

      const resolved = await TestConfigModel.resolveSecrets(provider);
      expect(resolved.get("apiKey")).toBe("resolved-api-key");
      expect(resolved.get("nested.secretToken")).toBe("resolved-token");
    });

    it("handles provider failures gracefully", async () => {
      const provider: SecretProvider = {
        getSecret: async () => {
          throw new Error("provider down");
        },
        name: "failing-provider",
      };

      const resolved = await TestConfigModel.resolveSecrets(provider);
      expect(resolved.size).toBe(0);
    });

    it("handles partial resolution", async () => {
      const provider: SecretProvider = {
        getSecret: async (name: string) => {
          if (name === "ext-api-key") {
            return "resolved-key";
          }
          return null;
        },
        name: "partial-provider",
      };

      const resolved = await TestConfigModel.resolveSecrets(provider);
      expect(resolved.size).toBe(1);
      expect(resolved.get("apiKey")).toBe("resolved-key");
    });
  });

  describe("singleton behavior (requires MongoDB)", () => {
    let dbConnected = false;

    beforeAll(async () => {
      try {
        if (mongoose.connection.readyState === 1) {
          dbConnected = true;
        } else {
          await mongoose.connect("mongodb://127.0.0.1/terreno-config-test", {
            connectTimeoutMS: 3000,
            serverSelectionTimeoutMS: 3000,
          });
          dbConnected = true;
        }
      } catch {
        dbConnected = false;
      }
    });

    afterAll(async () => {
      if (dbConnected && mongoose.connection.readyState === 1) {
        try {
          await mongoose.connection.db?.dropDatabase();
        } catch {
          // ignore
        }
      }
    });

    beforeEach(async () => {
      if (!dbConnected) {
        return;
      }
      try {
        await SimpleConfigModel.collection.drop();
      } catch {
        // Collection may not exist yet
      }
      await SimpleConfigModel.ensureIndexes();
    });

    it("creates a document via getConfig when none exists", async () => {
      if (!dbConnected) {
        return;
      }
      const config = await SimpleConfigModel.getConfig();
      expect(config).toBeDefined();
      expect(config.value).toBe("default");
    });

    it("returns the same document on subsequent getConfig calls", async () => {
      if (!dbConnected) {
        return;
      }
      const first = await SimpleConfigModel.getConfig();
      const second = await SimpleConfigModel.getConfig();
      expect(first._id.toString()).toBe(second._id.toString());
    });

    it("prevents creating a second document via save", async () => {
      if (!dbConnected) {
        return;
      }
      await SimpleConfigModel.getConfig();
      const duplicate = new SimpleConfigModel({value: "duplicate"});
      await expect(duplicate.save()).rejects.toThrow();
    });

    it("updates an existing document via updateConfig", async () => {
      if (!dbConnected) {
        return;
      }
      await SimpleConfigModel.getConfig();
      const updated = await SimpleConfigModel.updateConfig({value: "updated"});
      expect(updated.value).toBe("updated");

      const count = await SimpleConfigModel.countDocuments();
      expect(count).toBe(1);
    });

    it("creates a document with values if none exists via updateConfig", async () => {
      if (!dbConnected) {
        return;
      }
      const config = await SimpleConfigModel.updateConfig({value: "custom"});
      expect(config.value).toBe("custom");
    });

    it("prevents deleteOne", async () => {
      if (!dbConnected) {
        return;
      }
      await SimpleConfigModel.getConfig();
      await expect(SimpleConfigModel.deleteOne({})).rejects.toThrow(
        /Cannot delete the configuration document/
      );
    });

    it("prevents findOneAndDelete", async () => {
      if (!dbConnected) {
        return;
      }
      await SimpleConfigModel.getConfig();
      await expect(SimpleConfigModel.findOneAndDelete({})).rejects.toThrow(
        /Cannot delete the configuration document/
      );
    });

    it("prevents deleteMany", async () => {
      if (!dbConnected) {
        return;
      }
      await SimpleConfigModel.getConfig();
      await expect(SimpleConfigModel.deleteMany({})).rejects.toThrow(
        /Cannot delete the configuration document/
      );
    });
  });
});
