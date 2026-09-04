import {afterEach, beforeAll, beforeEach, describe, expect, it, mock} from "bun:test";
import {TerrenoApp} from "@terreno/api";
import type {LanguageModel} from "ai";
import type express from "express";

import {AIRequest} from "../../models/aiRequest";
import {AIService} from "../../service/aiService";
import {authAsUser, ensureTestUsers, UserModel} from "../../tests/helpers";
import {createLocalObservabilityPlugin} from "../local/localPlugin";
import {registerObsPrompt} from "../local/models/obsPrompt";
import {registerObsPromptLabel} from "../local/models/obsPromptLabel";
import {registerObsPromptVersion} from "../local/models/obsPromptVersion";
import {registerObsTrace} from "../local/models/obsTrace";
import {ObservabilityApp, resetObservabilityApp} from "../observabilityApp";

const createMockModel = (responseText = "Playground output") => {
  return {
    doGenerate: mock(async () => ({
      content: [{text: responseText, type: "text" as const}],
      finishReason: "stop" as const,
      usage: {inputTokens: 5, outputTokens: 10},
    })),
    doStream: mock(async () => ({
      stream: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    })),
    modelId: "mock-model",
    provider: "mock-provider",
    specificationVersion: "v2" as const,
    supportedUrls: {},
  };
};

describe("observability prompt routes", () => {
  let app: express.Application;
  let doGenerate: ReturnType<typeof mock>;

  beforeAll(async () => {
    await ensureTestUsers();
  });

  afterEach(() => {
    resetObservabilityApp();
  });

  beforeEach(async () => {
    await registerObsPrompt().deleteMany({});
    await registerObsPromptVersion().deleteMany({});
    await registerObsPromptLabel().deleteMany({});
    await registerObsTrace().deleteMany({});
    await AIRequest.deleteMany({});

    const model = createMockModel();
    doGenerate = model.doGenerate;
    const aiService = new AIService({model: model as unknown as LanguageModel});
    app = new TerrenoApp({skipListen: true, userModel: UserModel})
      .register(
        new ObservabilityApp({
          aiService,
          plugins: [createLocalObservabilityPlugin()],
          priceMap: {"mock-model": {inputPerMTok: 1000, outputPerMTok: 2000}},
        })
      )
      .build();
  });

  it("creates versions, pins production, and runs playground without a new version", async () => {
    const agent = await authAsUser(app, "admin");

    const created = await agent.post("/ai/observability/prompts").send({
      folder: "examples",
      name: "greeter",
      system: "Greet {{name}}",
      template: "Say hello to {{name}}",
      type: "text",
    });
    expect(created.status).toBe(201);

    await agent.post("/ai/observability/prompts/greeter/labels").send({
      label: "production",
      version: 1,
    });
    const v2 = await agent.post("/ai/observability/prompts/greeter/versions").send({
      system: "Greet politely {{name}}",
      template: "Hi {{name}}",
      type: "text",
    });
    expect(v2.status).toBe(201);
    expect(v2.body.data.version).toBe(2);

    const moved = await agent.post("/ai/observability/prompts/greeter/labels").send({
      label: "production",
      version: 2,
    });
    expect(moved.body.data.outgoingVersion).toBe(1);

    const detail = await agent.get("/ai/observability/prompts/greeter");
    expect(detail.body.data.versions[0].system).toBe("Greet {{name}}");
    expect(detail.body.data.versions).toHaveLength(2);

    const playground = await agent.post("/ai/observability/prompts/greeter/playground").send({
      variables: {name: "Ada"},
      version: 1,
    });
    expect(playground.status).toBe(200);
    expect(playground.body.data.compiledMessages).toEqual([
      {content: "Greet Ada", role: "system"},
      {content: "Say hello to Ada", role: "user"},
    ]);
    expect(playground.body.data.output).toBe("Playground output");
    expect(playground.body.data.tokens).toEqual({
      inputTokens: 5,
      outputTokens: 10,
      totalTokens: 15,
    });
    expect(playground.body.data.costUsd).toBeCloseTo(0.025);
    expect(playground.body.data.latencyMs).toBeGreaterThanOrEqual(0);
    expect(doGenerate).toHaveBeenCalledTimes(1);

    const after = await agent.get("/ai/observability/prompts/greeter");
    expect(after.body.data.versions).toHaveLength(2);
  });

  it("forbids non-admins from creating prompts", async () => {
    const agent = await authAsUser(app, "notAdmin");
    const res = await agent.post("/ai/observability/prompts").send({
      folder: "examples",
      name: "blocked",
      type: "text",
    });
    expect(res.status).toBe(403);
  });

  it("lists folder matches with usage7d and — when production is unset", async () => {
    const agent = await authAsUser(app, "admin");
    await agent.post("/ai/observability/prompts").send({
      folder: "examples",
      name: "summarize",
      system: "Summarize",
      type: "text",
    });
    const listed = await agent.get(
      "/ai/observability/prompts?folder=examples&search=sum&include=usage7d"
    );
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([
      {
        folder: "examples",
        latestVersion: 1,
        name: "summarize",
        production: "—",
        type: "text",
        usage7d: {calls: 0},
      },
    ]);
  });
});
