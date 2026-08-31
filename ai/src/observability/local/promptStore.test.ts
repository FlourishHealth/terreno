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
});
