// biome-ignore-all lint/suspicious/noExplicitAny: test model typing
import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import mongoose, {Schema} from "mongoose";

import {Config} from "./config";
import {envConfigurationPlugin} from "./envConfigurationPlugin";

interface EnvDocShape {
  env: Map<string, string>;
}

const testSchema = new Schema<EnvDocShape>({}, {strict: "throw"});
testSchema.plugin(envConfigurationPlugin);

const TestEnvConfig =
  (mongoose.models.TestEnvConfig as mongoose.Model<EnvDocShape>) ??
  mongoose.model<EnvDocShape>("TestEnvConfig", testSchema);

const setupLoader = (): void => {
  Config.setEnvLoader(async () => {
    const doc = (await TestEnvConfig.findOne({}).lean()) as {
      env?: Map<string, string> | Record<string, string>;
    } | null;
    if (!doc?.env) {
      return {};
    }
    if (doc.env instanceof Map) {
      const out: Record<string, string> = {};
      for (const [k, v] of doc.env) {
        out[k] = v;
      }
      return out;
    }
    return {...doc.env};
  });
};

describe("envConfigurationPlugin", () => {
  beforeEach(async () => {
    Config.clearRegistryForTesting();
    Config.clearOverrides();
    Config.setCachedEnv(null);
    Config.setEnvLoader(null);
    Reflect.deleteProperty(process.env, "TERRENO_PLUGIN_KEY");

    Config.register("TERRENO_PLUGIN_KEY", {default: "fallback"});

    await mongoose.connection.db?.collection("testenvconfigs").deleteMany({});
    setupLoader();
  });

  afterEach(async () => {
    Config.clearRegistryForTesting();
    Config.clearOverrides();
    Config.setCachedEnv(null);
    Config.setEnvLoader(null);
    Reflect.deleteProperty(process.env, "TERRENO_PLUGIN_KEY");
    await mongoose.connection.db?.collection("testenvconfigs").deleteMany({});
  });

  it("adds an env Map field to the schema", () => {
    const doc = new TestEnvConfig();
    expect(doc.env).toBeInstanceOf(Map);
  });

  it("Config.refresh() loads values from the document", async () => {
    const doc = new TestEnvConfig();
    doc.env.set("TERRENO_PLUGIN_KEY", "fromDoc");
    await doc.save();

    Config.setCachedEnv(null);
    await Config.refresh();

    expect(Config.get("TERRENO_PLUGIN_KEY")).toBe("fromDoc");
  });

  it("post-save hook refreshes the cache automatically", async () => {
    const doc = new TestEnvConfig();
    doc.env.set("TERRENO_PLUGIN_KEY", "first");
    await doc.save();
    expect(Config.get("TERRENO_PLUGIN_KEY")).toBe("first");

    doc.env.set("TERRENO_PLUGIN_KEY", "second");
    await doc.save();
    expect(Config.get("TERRENO_PLUGIN_KEY")).toBe("second");
  });

  it("post-findOneAndUpdate hook refreshes the cache", async () => {
    const doc = new TestEnvConfig();
    doc.env.set("TERRENO_PLUGIN_KEY", "initial");
    await doc.save();

    await TestEnvConfig.findOneAndUpdate(
      {_id: doc._id},
      {env: new Map([["TERRENO_PLUGIN_KEY", "updated"]])}
    );

    expect(Config.get("TERRENO_PLUGIN_KEY")).toBe("updated");
  });

  it("empty-string env values fall through to process.env", async () => {
    process.env.TERRENO_PLUGIN_KEY = "fromEnv";
    const doc = new TestEnvConfig();
    doc.env.set("TERRENO_PLUGIN_KEY", "");
    await doc.save();

    expect(Config.get("TERRENO_PLUGIN_KEY")).toBe("fromEnv");
  });

  it("missing document yields registered defaults", async () => {
    await Config.refresh();
    expect(Config.get("TERRENO_PLUGIN_KEY")).toBe("fallback");
  });
});
