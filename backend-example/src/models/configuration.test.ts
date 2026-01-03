import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it} from "bun:test";

import {assert} from "chai";
import {connectToMongoDB} from "../utils/database";
import {Configuration, ConfigurationDB} from "./configuration";

describe("ConfigurationDB Model", () => {
  beforeAll(async () => {
    await connectToMongoDB();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await ConfigurationDB.deleteMany({});
    Configuration.clearAll();
  });

  afterAll(async () => {
    await ConfigurationDB.deleteMany({});
  });

  describe("setValue", () => {
    it("should create a new configuration", async () => {
      const config = await ConfigurationDB.setValue("TEST_KEY", "test-value");

      assert.strictEqual(config.key, "TEST_KEY");
      assert.strictEqual(config.value, "test-value");
      assert.strictEqual(config.type, "string");
    });

    it("should update existing configuration", async () => {
      // Create initial
      await ConfigurationDB.setValue("TEST_KEY", "initial");

      // Update
      const updated = await ConfigurationDB.setValue("TEST_KEY", "updated");

      assert.strictEqual(updated.value, "updated");

      // Verify only one document exists
      const allConfigs = await ConfigurationDB.find({key: "TEST_KEY"});
      assert.strictEqual(allConfigs.length, 1);
    });

    it("should infer type from value", async () => {
      const stringConfig = await ConfigurationDB.setValue("STRING_KEY", "text");
      assert.strictEqual(stringConfig.type, "string");

      const numberConfig = await ConfigurationDB.setValue("NUMBER_KEY", 42);
      assert.strictEqual(numberConfig.type, "number");

      const boolConfig = await ConfigurationDB.setValue("BOOL_KEY", true);
      assert.strictEqual(boolConfig.type, "boolean");
    });
  });

  describe("getByKey", () => {
    it("should return configuration by key", async () => {
      await ConfigurationDB.setValue("MY_KEY", "my-value");

      const config = await ConfigurationDB.getByKey("MY_KEY");

      assert.isNotNull(config);
      assert.strictEqual(config?.key, "MY_KEY");
      assert.strictEqual(config?.value, "my-value");
    });

    it("should return null for non-existent key", async () => {
      const config = await ConfigurationDB.getByKey("NONEXISTENT");
      assert.isNull(config);
    });
  });

  describe("getValue method", () => {
    it("should return the value", async () => {
      const config = await ConfigurationDB.setValue("TEST_KEY", "test-value");

      const value = config.getValue();
      assert.strictEqual(value, "test-value");
    });
  });

  describe("Integration with Configuration class", () => {
    it("should allow setting configuration via Configuration.setDB", async () => {
      await Configuration.setDB("DB_TEST", "from-db");

      const config = await ConfigurationDB.getByKey("DB_TEST");
      assert.strictEqual(config?.value, "from-db");
    });

    it("should validate configuration when setting via Configuration.setDB", async () => {
      Configuration.register("VALIDATED_CONFIG", {
        type: "number",
        validator: (value) => typeof value === "number" && value > 0 && value < 100,
      });

      // Valid value should work
      await Configuration.setDB("VALIDATED_CONFIG", 50);
      const config = await ConfigurationDB.getByKey("VALIDATED_CONFIG");
      assert.strictEqual(config?.value, 50);

      // Invalid value should throw
      try {
        await Configuration.setDB("VALIDATED_CONFIG", 150);
        assert.fail("Should have thrown validation error");
      } catch (error) {
        assert.include((error as Error).message, "validation failed");
      }
    });

    it("should reject undefined values", async () => {
      try {
        await Configuration.setDB("TEST_KEY", null);
        assert.fail("Should have thrown error for undefined value");
      } catch (error) {
        assert.include((error as Error).message, "Cannot set undefined");
      }
    });
  });

  describe("Change Stream Integration", () => {
    beforeAll(async () => {
      await Configuration.initialize();
    });

    afterAll(async () => {
      await Configuration.shutdown();
    });

    it("should update cache when database changes", async () => {
      // Set in database
      await Configuration.setDB("STREAM_TEST", "initial");

      // Wait for change stream to process
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should be in cache
      const cachedValue = Configuration.get<string>("STREAM_TEST");
      assert.strictEqual(cachedValue, "initial");

      // Update in database
      await ConfigurationDB.setValue("STREAM_TEST", "updated");

      // Wait for change stream
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Cache should be updated
      const updatedValue = Configuration.get<string>("STREAM_TEST");
      assert.strictEqual(updatedValue, "updated");
    });

    it("should cache configuration on initialization", async () => {
      // Create configs before loading
      await ConfigurationDB.setValue("PRELOAD_1", "value1");
      await ConfigurationDB.setValue("PRELOAD_2", 42);
      await ConfigurationDB.setValue("PRELOAD_3", true);

      // Reload configuration
      await Configuration.loadFromDB();

      // Check cache has all values
      const dbCache = Configuration.getDBCache();
      assert.strictEqual(dbCache.PRELOAD_1, "value1");
      assert.strictEqual(dbCache.PRELOAD_2, 42);
      assert.strictEqual(dbCache.PRELOAD_3, true);
    });
  });

  describe("Priority System", () => {
    beforeAll(async () => {
      await Configuration.initialize();
    });

    afterAll(async () => {
      await Configuration.shutdown();
    });

    it("should respect priority: runtime > database > env > default", async () => {
      // Setup
      Configuration.register("PRIORITY_TEST", {
        defaultValue: "default",
        envVar: "PRIORITY_TEST",
        type: "string",
      });

      // Default value
      let value = Configuration.get<string>("PRIORITY_TEST");
      assert.strictEqual(value, "default");

      // Environment variable
      process.env.PRIORITY_TEST = "from-env";
      value = Configuration.get<string>("PRIORITY_TEST");
      assert.strictEqual(value, "from-env");

      // Database value
      await Configuration.setDB("PRIORITY_TEST", "from-db");
      await new Promise((resolve) => setTimeout(resolve, 200)); // Wait for change stream
      value = Configuration.get<string>("PRIORITY_TEST");
      assert.strictEqual(value, "from-db");

      // Runtime override
      Configuration.set("PRIORITY_TEST", "runtime");
      value = Configuration.get<string>("PRIORITY_TEST");
      assert.strictEqual(value, "runtime");

      // Clear runtime
      Configuration.clear("PRIORITY_TEST");
      value = Configuration.get<string>("PRIORITY_TEST");
      assert.strictEqual(value, "from-db");

      // Cleanup
      delete process.env.PRIORITY_TEST;
    });
  });
});

describe("Configuration", () => {
  // Store original env vars
  const originalEnv = {...process.env};

  beforeEach(() => {
    // Clear runtime overrides before each test
    Configuration.clearAll();
  });

  afterEach(() => {
    // Restore original environment
    process.env = {...originalEnv};
    Configuration.clearAll();
  });

  describe("singleton pattern", () => {
    it("should prevent instantiation", () => {
      // Attempt to instantiate should throw an error
      expect(() => {
        // @ts-expect-error - Testing that constructor is private
        new Configuration();
      }).toThrow("Configuration is a singleton and cannot be instantiated");
    });
  });

  describe("register and get", () => {
    it("should register and get a configuration with default value", () => {
      Configuration.register("TEST_CONFIG", {
        defaultValue: "test-value",
        type: "string",
      });

      const value = Configuration.get<string>("TEST_CONFIG");
      expect(value).toBe("test-value");
    });

    it("should get value from environment variable", () => {
      process.env.TEST_ENV_VAR = "env-value";

      Configuration.register("TEST_CONFIG", {
        defaultValue: "default-value",
        envVar: "TEST_ENV_VAR",
        type: "string",
      });

      const value = Configuration.get<string>("TEST_CONFIG");
      expect(value).toBe("env-value");
    });

    it("should use fallback when no value is found", () => {
      const value = Configuration.get<string>("NON_EXISTENT", "fallback-value");
      expect(value).toBe("fallback-value");
    });

    it("should convert string to number", () => {
      process.env.TEST_NUMBER = "42";

      Configuration.register("TEST_NUMBER_CONFIG", {
        envVar: "TEST_NUMBER",
        type: "number",
      });

      const value = Configuration.get<number>("TEST_NUMBER_CONFIG");
      expect(value).toBe(42);
      expect(typeof value).toBe("number");
    });

    it("should convert string to boolean", () => {
      process.env.TEST_BOOL_TRUE = "true";
      process.env.TEST_BOOL_FALSE = "false";

      Configuration.register("TEST_BOOL_TRUE_CONFIG", {
        envVar: "TEST_BOOL_TRUE",
        type: "boolean",
      });

      Configuration.register("TEST_BOOL_FALSE_CONFIG", {
        envVar: "TEST_BOOL_FALSE",
        type: "boolean",
      });

      const valueTrue = Configuration.get<boolean>("TEST_BOOL_TRUE_CONFIG");
      const valueFalse = Configuration.get<boolean>("TEST_BOOL_FALSE_CONFIG");

      expect(valueTrue).toBe(true);
      expect(valueFalse).toBe(false);
    });

    it("should convert '1' to boolean true", () => {
      process.env.TEST_BOOL_ONE = "1";

      Configuration.register("TEST_BOOL_ONE_CONFIG", {
        envVar: "TEST_BOOL_ONE",
        type: "boolean",
      });

      const value = Configuration.get<boolean>("TEST_BOOL_ONE_CONFIG");
      expect(value).toBe(true);
    });
  });

  describe("set and runtime overrides", () => {
    it("should set runtime value", () => {
      Configuration.register("TEST_CONFIG", {
        defaultValue: "default",
        type: "string",
      });

      Configuration.set("TEST_CONFIG", "runtime-value");

      const value = Configuration.get<string>("TEST_CONFIG");
      expect(value).toBe("runtime-value");
    });

    it("should prioritize runtime override over environment variable", () => {
      process.env.TEST_ENV = "env-value";

      Configuration.register("TEST_CONFIG", {
        defaultValue: "default",
        envVar: "TEST_ENV",
        type: "string",
      });

      Configuration.set("TEST_CONFIG", "runtime-value");

      const value = Configuration.get<string>("TEST_CONFIG");
      expect(value).toBe("runtime-value");
    });

    it("should clear runtime override", () => {
      Configuration.register("TEST_CONFIG", {
        defaultValue: "default",
        type: "string",
      });

      Configuration.set("TEST_CONFIG", "runtime-value");
      expect(Configuration.get<string>("TEST_CONFIG")).toBe("runtime-value");

      Configuration.clear("TEST_CONFIG");
      expect(Configuration.get<string>("TEST_CONFIG")).toBe("default");
    });

    it("should clear all runtime overrides", () => {
      Configuration.register("TEST_CONFIG_1", {defaultValue: "default1"});
      Configuration.register("TEST_CONFIG_2", {defaultValue: "default2"});

      Configuration.set("TEST_CONFIG_1", "runtime1");
      Configuration.set("TEST_CONFIG_2", "runtime2");

      Configuration.clearAll();

      expect(Configuration.get<string>("TEST_CONFIG_1")).toBe("default1");
      expect(Configuration.get<string>("TEST_CONFIG_2")).toBe("default2");
    });
  });

  describe("validator", () => {
    it("should validate config value", () => {
      Configuration.register("TEST_PORT", {
        defaultValue: 3000,
        type: "number",
        validator: (value) => {
          return typeof value === "number" && value > 0 && value < 65536;
        },
      });

      // Should not throw for valid value
      Configuration.set("TEST_PORT", 8080);
      expect(Configuration.get<number>("TEST_PORT")).toBe(8080);
    });

    it("should throw error for invalid runtime value", () => {
      Configuration.register("TEST_PORT", {
        defaultValue: 3000,
        type: "number",
        validator: (value) => {
          return typeof value === "number" && value > 0 && value < 65536;
        },
      });

      // Should throw for invalid value
      expect(() => {
        Configuration.set("TEST_PORT", 99999);
      }).toThrow();
    });

    it("should fall back to default for invalid env value", () => {
      process.env.TEST_PORT = "99999";

      Configuration.register("TEST_PORT", {
        defaultValue: 3000,
        envVar: "TEST_PORT",
        type: "number",
        validator: (value) => {
          return typeof value === "number" && value > 0 && value < 65536;
        },
      });

      const value = Configuration.get<number>("TEST_PORT");
      expect(value).toBe(3000); // Should use default because env value is invalid
    });
  });

  describe("utility methods", () => {
    it("should get all registered keys", () => {
      Configuration.register("KEY1", {defaultValue: "value1"});
      Configuration.register("KEY2", {defaultValue: "value2"});

      const keys = Configuration.getKeys();
      expect(keys).toContain("KEY1");
      expect(keys).toContain("KEY2");
    });

    it("should get configuration definition", () => {
      const definition = {
        defaultValue: "test",
        description: "Test configuration",
        type: "string" as const,
      };

      Configuration.register("TEST_KEY", definition);

      const retrieved = Configuration.getDefinition("TEST_KEY");
      expect(retrieved?.defaultValue).toBe("test");
      expect(retrieved?.type).toBe("string");
      expect(retrieved?.description).toBe("Test configuration");
    });

    it("should get all configuration values", () => {
      Configuration.register("CONFIG1", {defaultValue: "value1"});
      Configuration.register("CONFIG2", {defaultValue: 42, type: "number"});

      const allConfig = Configuration.getAll();

      expect(allConfig.CONFIG1).toBe("value1");
      expect(allConfig.CONFIG2).toBe(42);
    });
  });

  describe("edge cases", () => {
    it("should handle unregistered config key", () => {
      const value = Configuration.get<string>("UNREGISTERED_KEY", "fallback");
      expect(value).toBe("fallback");
    });

    it("should handle undefined environment variable", () => {
      Configuration.register("TEST_CONFIG", {
        defaultValue: "default-value",
        envVar: "NON_EXISTENT_ENV_VAR",
        type: "string",
      });

      const value = Configuration.get<string>("TEST_CONFIG");
      expect(value).toBe("default-value");
    });

    it("should handle invalid number conversion", () => {
      process.env.INVALID_NUMBER = "not-a-number";

      Configuration.register("TEST_NUMBER", {
        defaultValue: 42,
        envVar: "INVALID_NUMBER",
        type: "number",
      });

      const value = Configuration.get<number>("TEST_NUMBER");
      expect(value).toBe(42); // Should fall back to default
    });

    it("should access env var directly if not registered", () => {
      process.env.DIRECT_ACCESS = "direct-value";

      const value = Configuration.get<string>("DIRECT_ACCESS");
      expect(value).toBe("direct-value");
    });
  });

  describe("pre-registered configurations", () => {
    it("should have APP_NAME registered", () => {
      const appName = Configuration.get<string>("APP_NAME");
      expect(appName).toBe("Terreno Example");
    });

    it("should have DEFAULT_PAGE_SIZE registered", () => {
      const pageSize = Configuration.get<number>("DEFAULT_PAGE_SIZE");
      expect(pageSize).toBe(20);
    });

    it("should have MAX_PAGE_SIZE registered", () => {
      const maxPageSize = Configuration.get<number>("MAX_PAGE_SIZE");
      expect(maxPageSize).toBe(100);
    });
  });
});
