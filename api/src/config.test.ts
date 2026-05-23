import {afterEach, beforeEach, describe, expect, it} from "bun:test";

import {Config} from "./config";

const KEYS = [
  "TERRENO_CFG_STRING",
  "TERRENO_CFG_DEFAULTED",
  "TERRENO_CFG_NUM",
  "TERRENO_CFG_BOOL",
  "TERRENO_CFG_JSON",
  "TERRENO_CFG_UNDEFAULTED",
  "TERRENO_CFG_UNREGISTERED",
];

const resetEnv = (): void => {
  for (const key of KEYS) {
    Reflect.deleteProperty(process.env, key);
  }
};

describe("Config", () => {
  beforeEach(() => {
    Config.clearRegistryForTesting();
    Config.clearOverrides();
    Config.setCachedEnv(null);
    Config.setEnvLoader(null);
    resetEnv();

    Config.register("TERRENO_CFG_STRING");
    Config.register("TERRENO_CFG_DEFAULTED", {default: "fallback"});
    Config.register("TERRENO_CFG_NUM", {default: "1000"});
    Config.register("TERRENO_CFG_BOOL", {default: "false"});
    Config.register("TERRENO_CFG_JSON", {default: "{}"});
    Config.register("TERRENO_CFG_UNDEFAULTED");
  });

  afterEach(() => {
    resetEnv();
    Config.clearRegistryForTesting();
    Config.clearOverrides();
    Config.setCachedEnv(null);
    Config.setEnvLoader(null);
  });

  describe("resolution order", () => {
    it("returns the registered default when nothing is set", () => {
      expect(Config.get("TERRENO_CFG_DEFAULTED")).toBe("fallback");
    });

    it("returns process.env when set and no cache/override is present", () => {
      process.env.TERRENO_CFG_STRING = "fromEnv";
      expect(Config.get("TERRENO_CFG_STRING")).toBe("fromEnv");
    });

    it("cache wins over process.env", () => {
      process.env.TERRENO_CFG_STRING = "fromEnv";
      Config.setCachedEnv({TERRENO_CFG_STRING: "fromCache"});
      expect(Config.get("TERRENO_CFG_STRING")).toBe("fromCache");
    });

    it("override wins over cache and process.env", () => {
      process.env.TERRENO_CFG_STRING = "fromEnv";
      Config.setCachedEnv({TERRENO_CFG_STRING: "fromCache"});
      Config.setOverride("TERRENO_CFG_STRING", "fromOverride");
      expect(Config.get("TERRENO_CFG_STRING")).toBe("fromOverride");
    });

    it("falls through empty-string cache values to process.env", () => {
      process.env.TERRENO_CFG_STRING = "fromEnv";
      Config.setCachedEnv({TERRENO_CFG_STRING: ""});
      expect(Config.get("TERRENO_CFG_STRING")).toBe("fromEnv");
    });

    it("falls through empty-string process.env to default", () => {
      process.env.TERRENO_CFG_DEFAULTED = "";
      expect(Config.get("TERRENO_CFG_DEFAULTED")).toBe("fallback");
    });

    it("returns undefined for an unregistered key with nothing set", () => {
      expect(Config.get("TERRENO_CFG_UNREGISTERED")).toBeUndefined();
    });

    it("returns process.env for an unregistered key when set", () => {
      process.env.TERRENO_CFG_UNREGISTERED = "value";
      expect(Config.get("TERRENO_CFG_UNREGISTERED")).toBe("value");
    });

    it("setOverride(key, undefined) is treated as 'force unset'", () => {
      process.env.TERRENO_CFG_STRING = "fromEnv";
      Config.setOverride("TERRENO_CFG_STRING", undefined);
      expect(Config.get("TERRENO_CFG_STRING")).toBeUndefined();
    });
  });

  describe("getNumber", () => {
    it("parses numeric process.env values", () => {
      process.env.TERRENO_CFG_NUM = "5000";
      expect(Config.getNumber("TERRENO_CFG_NUM")).toBe(5000);
    });

    it("parses the registered default", () => {
      expect(Config.getNumber("TERRENO_CFG_NUM")).toBe(1000);
    });

    it("returns undefined when no value is available", () => {
      expect(Config.getNumber("TERRENO_CFG_UNDEFAULTED")).toBeUndefined();
    });

    it("throws on non-numeric values", () => {
      process.env.TERRENO_CFG_NUM = "not-a-number";
      expect(() => Config.getNumber("TERRENO_CFG_NUM")).toThrow(/not a valid number/);
    });

    it("throws on partially-numeric strings like '5000ms'", () => {
      process.env.TERRENO_CFG_NUM = "5000ms";
      expect(() => Config.getNumber("TERRENO_CFG_NUM")).toThrow(/not a valid number/);
    });

    it("supports floats", () => {
      process.env.TERRENO_CFG_NUM = "3.14";
      expect(Config.getNumber("TERRENO_CFG_NUM")).toBe(3.14);
    });
  });

  describe("getBoolean", () => {
    it("returns true for 'true'", () => {
      process.env.TERRENO_CFG_BOOL = "true";
      expect(Config.getBoolean("TERRENO_CFG_BOOL")).toBe(true);
    });

    it("returns true for 'TRUE' (case-insensitive)", () => {
      process.env.TERRENO_CFG_BOOL = "TRUE";
      expect(Config.getBoolean("TERRENO_CFG_BOOL")).toBe(true);
    });

    it("returns false for 'false'", () => {
      process.env.TERRENO_CFG_BOOL = "false";
      expect(Config.getBoolean("TERRENO_CFG_BOOL")).toBe(false);
    });

    it("returns false when unset and default is 'false'", () => {
      expect(Config.getBoolean("TERRENO_CFG_BOOL")).toBe(false);
    });

    it("returns false for any non-true string", () => {
      process.env.TERRENO_CFG_BOOL = "yes";
      expect(Config.getBoolean("TERRENO_CFG_BOOL")).toBe(false);
    });
  });

  describe("getJSON", () => {
    it("parses valid JSON", () => {
      process.env.TERRENO_CFG_JSON = JSON.stringify({hook: "https://example.com"});
      expect(Config.getJSON<Record<string, string>>("TERRENO_CFG_JSON")).toEqual({
        hook: "https://example.com",
      });
    });

    it("parses the registered default", () => {
      expect(Config.getJSON<Record<string, unknown>>("TERRENO_CFG_JSON")).toEqual({});
    });

    it("returns undefined when nothing is set and no default exists", () => {
      expect(Config.getJSON("TERRENO_CFG_UNDEFAULTED")).toBeUndefined();
    });

    it("throws on malformed JSON instead of silently returning undefined", () => {
      process.env.TERRENO_CFG_JSON = "{not json";
      expect(() => Config.getJSON("TERRENO_CFG_JSON")).toThrow(/not valid JSON/);
    });
  });

  describe("registry", () => {
    it("exposes registered keys in sorted order", () => {
      const keys = Config.getRegisteredKeys();
      const sorted = [...keys].sort();
      expect(keys).toEqual(sorted);
    });

    it("isRegistered returns true for known keys", () => {
      expect(Config.isRegistered("TERRENO_CFG_STRING")).toBe(true);
    });

    it("isRegistered returns false for unknown keys", () => {
      expect(Config.isRegistered("NOT_A_REAL_KEY")).toBe(false);
    });

    it("getDefault returns the registered default", () => {
      expect(Config.getDefault("TERRENO_CFG_DEFAULTED")).toBe("fallback");
    });

    it("getDefault returns undefined for keys with no default", () => {
      expect(Config.getDefault("TERRENO_CFG_STRING")).toBeUndefined();
    });

    it("getRegistration exposes secret + description metadata", () => {
      Config.register("TERRENO_CFG_WITH_META", {
        description: "A secret thing",
        secret: true,
      });
      const meta = Config.getRegistration("TERRENO_CFG_WITH_META");
      expect(meta?.secret).toBe(true);
      expect(meta?.description).toBe("A secret thing");
    });

    it("re-registering the same key throws", () => {
      expect(() => Config.register("TERRENO_CFG_STRING")).toThrow(/registered more than once/);
    });

    it("does not treat Object prototype keys as registered", () => {
      expect(Config.isRegistered("constructor")).toBe(false);
      expect(Config.isRegistered("toString")).toBe(false);
      expect(Config.isRegistered("hasOwnProperty")).toBe(false);
      // And re-registering one of these names should still succeed.
      expect(() => Config.register("toString", {default: "x"})).not.toThrow();
      expect(Config.get("toString")).toBe("x");
    });
  });

  describe("clearOverrides", () => {
    it("removes all overrides", () => {
      Config.setOverride("TERRENO_CFG_STRING", "x");
      Config.setOverride("TERRENO_CFG_DEFAULTED", "y");
      Config.clearOverrides();
      expect(Config.get("TERRENO_CFG_STRING")).toBeUndefined();
      expect(Config.get("TERRENO_CFG_DEFAULTED")).toBe("fallback");
    });
  });

  describe("refresh", () => {
    it("loads values via the registered env loader", async () => {
      Config.setEnvLoader(async () => ({TERRENO_CFG_STRING: "fromLoader"}));
      await Config.refresh();
      expect(Config.get("TERRENO_CFG_STRING")).toBe("fromLoader");
    });

    it("clears the cache when no loader is registered", async () => {
      Config.setCachedEnv({TERRENO_CFG_STRING: "stale"});
      Config.setEnvLoader(null);
      await Config.refresh();
      expect(Config.get("TERRENO_CFG_STRING")).toBeUndefined();
    });

    it("updates the cache on each refresh", async () => {
      let payload: Record<string, string> = {TERRENO_CFG_STRING: "first"};
      Config.setEnvLoader(async () => payload);
      await Config.refresh();
      expect(Config.get("TERRENO_CFG_STRING")).toBe("first");

      payload = {TERRENO_CFG_STRING: "second"};
      await Config.refresh();
      expect(Config.get("TERRENO_CFG_STRING")).toBe("second");
    });
  });
});
