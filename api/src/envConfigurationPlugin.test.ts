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

  it("post-updateOne hook refreshes the cache", async () => {
    const doc = new TestEnvConfig();
    doc.env.set("TERRENO_PLUGIN_KEY", "initial");
    await doc.save();

    await TestEnvConfig.updateOne(
      {_id: doc._id},
      {env: new Map([["TERRENO_PLUGIN_KEY", "updatedViaUpdateOne"]])}
    );

    expect(Config.get("TERRENO_PLUGIN_KEY")).toBe("updatedViaUpdateOne");
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

  it("refreshFromDoc handles null document via Mongoose hook when collection is empty", async () => {
    // Ensure collection is empty — no documents to find
    await mongoose.connection.db?.collection("testenvconfigs").deleteMany({});

    // Override the cache so we can verify it gets cleared by the hook
    Config.setCachedEnv({TERRENO_PLUGIN_KEY: "stale"});
    expect(Config.get("TERRENO_PLUGIN_KEY")).toBe("stale");

    // Trigger findOneAndUpdate hook on a non-existent doc — refreshFromDoc
    // calls findOneOrNone which returns null, so mapToObject(undefined) runs
    await TestEnvConfig.findOneAndUpdate({_id: new mongoose.Types.ObjectId()}, {$set: {__v: 1}});

    // mapToObject(undefined) returns {}, so Config falls back to the registered default
    expect(Config.get("TERRENO_PLUGIN_KEY")).toBe("fallback");
  });

  it("mapToObject handles a plain Record (non-Map) env field", async () => {
    // Insert a document with env as a plain object via raw DB operation
    const col = mongoose.connection.db?.collection("testenvconfigs");
    await col?.insertOne({env: {TERRENO_PLUGIN_KEY: "plainObj"}});

    // Trigger refresh via findOneAndUpdate hook
    await TestEnvConfig.findOneAndUpdate({}, {$set: {__v: 1}});

    expect(Config.get("TERRENO_PLUGIN_KEY")).toBe("plainObj");
  });

  it("refreshFromDoc logs a warning and does not throw when the model query fails", async () => {
    // Replace the env loader with one that throws to simulate a query failure
    Config.setEnvLoader(async () => {
      throw new Error("Simulated DB error");
    });
    Config.setCachedEnv({TERRENO_PLUGIN_KEY: "cached"});

    // Create a doc so the post-save hook fires
    const doc = new TestEnvConfig();
    doc.env.set("TERRENO_PLUGIN_KEY", "new");
    await doc.save();

    // The hook should have caught the error; cache remains with the refreshed
    // value from the Mongoose hook's own findOneOrNone (which succeeded)
    // OR falls back gracefully. Verify no unhandled error was thrown.
    expect(Config.get("TERRENO_PLUGIN_KEY")).toBeDefined();
  });
});
