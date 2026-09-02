import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {DateTime} from "luxon";

import {ObservabilityApp, resetObservabilityApp} from "../observabilityApp";
import {createLocalObservabilityPlugin} from "./localPlugin";
import {registerObsPrompt} from "./models/obsPrompt";
import {registerObsPromptLabel} from "./models/obsPromptLabel";
import {registerObsPromptVersion} from "./models/obsPromptVersion";
import {registerObsTrace} from "./models/obsTrace";
import {LocalPromptStore} from "./promptStore";

describe("LocalPromptStore", () => {
  let store: LocalPromptStore;

  afterEach(() => {
    resetObservabilityApp();
  });

  beforeEach(async () => {
    store = new LocalPromptStore();
    new ObservabilityApp({plugins: [createLocalObservabilityPlugin()]});
    await registerObsPrompt().deleteMany({});
    await registerObsPromptVersion().deleteMany({});
    await registerObsPromptLabel().deleteMany({});
    await registerObsTrace().deleteMany({});
  });

  it("leaves v1 unchanged after creating v2 and resolves production by label", async () => {
    await store.create({
      folder: "examples",
      name: "greeter",
      system: "You are v1",
      template: "Hello {{name}}",
      type: "text",
    });
    await store.moveLabel("greeter", {label: "production", version: 1});
    await store.createVersion("greeter", {
      system: "You are v2",
      template: "Hi {{name}}",
      type: "text",
    });
    const moved = await store.moveLabel("greeter", {label: "production", version: 2});

    const v1 = await registerObsPromptVersion().findExactlyOne({version: 1});
    expect(v1.system).toBe("You are v1");
    expect(moved.outgoingVersion).toBe(1);

    const production = await store.get({label: "production", name: "greeter"});
    expect(production?.version).toBe(2);
    expect(production?.body).toBe("You are v2");
  });

  it("returns — for production and 7-day usage rollup when include=usage7d", async () => {
    await store.create({
      folder: "examples",
      name: "summarize",
      system: "Summarize",
      type: "text",
    });
    await store.create({
      folder: "other",
      name: "unrelated",
      system: "Nope",
      type: "text",
    });
    const ObsTrace = registerObsTrace();
    await ObsTrace.create({
      created: DateTime.utc().minus({days: 1}).toJSDate(),
      name: "summarize-call",
      prompts: [{label: "production", name: "summarize", version: 1}],
      startedAt: DateTime.utc().minus({days: 1}).toJSDate(),
      status: "ok",
      usage: {costUsd: 0.4, inputTokens: 10, outputTokens: 20},
    });
    await ObsTrace.create({
      created: DateTime.utc().minus({days: 8}).toJSDate(),
      name: "old-call",
      prompts: [{name: "summarize", version: 1}],
      startedAt: DateTime.utc().minus({days: 8}).toJSDate(),
      status: "ok",
      usage: {costUsd: 9},
    });

    const listed = await store.list({folder: "examples", includeUsage7d: true, search: "sum"});
    expect(listed).toEqual([
      {
        folder: "examples",
        latestVersion: 1,
        name: "summarize",
        production: "—",
        type: "text",
        usage7d: {calls: 1, costUsd: 0.4},
      },
    ]);
  });

  it("validates create/moveLabel inputs and resolves versions by label or number", async () => {
    try {
      await store.create({folder: "", name: "bad"});
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toMatch(/folder and name/);
    }

    await store.create({
      folder: "examples",
      name: "versioned",
      system: "v1",
      type: "text",
    });
    await store.createVersion("versioned", {system: "v2", type: "text"});

    try {
      await store.moveLabel("versioned", {label: "qa", version: 2});
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toMatch(/production or staging/);
    }

    try {
      await store.moveLabel("versioned", {label: "production", version: 99});
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toMatch(/Unknown version 99/);
    }

    await store.create({
      folder: "examples",
      name: "duplicate",
      system: "one",
      type: "text",
    });
    try {
      await store.create({folder: "examples", name: "duplicate", system: "two", type: "text"});
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toMatch(/already exists/);
    }

    expect(await store.getVersionByLabel("missing")).toBeUndefined();
    expect((await store.getVersionByNumber("versioned", 2))?.system).toBe("v2");
    expect(await store.getVersionByNumber("versioned", 99)).toBeUndefined();
  });

  it("compiles templates and runs playground generation with optional pricing", async () => {
    await store.create({
      folder: "examples",
      name: "playground",
      system: "System {{name}}",
      template: "Hello {{name}}",
      type: "text",
      variables: [{key: "name", required: true}],
    });
    expect(store.compile({system: "", template: "Hi", variables: {}})).toEqual([
      {content: "Hi", role: "user"},
    ]);

    const result = await store.runPlayground({
      generator: {
        generate: async () => {
          return {inputTokens: 10, latencyMs: 12, output: "done", outputTokens: 5};
        },
      },
      modelId: "mock-model",
      name: "playground",
      priceMap: {["mock-model"]: {inputPerMTok: 1, outputPerMTok: 2}},
      variables: {name: "Ada"},
      version: 1,
    });
    expect(result.output).toBe("done");
    expect(result.costUsd).toBeCloseTo(0.00002);
    expect(result.compiledMessages).toEqual([
      {content: "System Ada", role: "system"},
      {content: "Hello Ada", role: "user"},
    ]);
  });
});
