import {afterEach, beforeAll, beforeEach, describe, expect, it, mock} from "bun:test";
import {TerrenoApp} from "@terreno/api";
import {assert} from "chai";
import type express from "express";

import {authAsUser, ensureTestUsers, UserModel} from "../../tests/helpers";
import {createLocalObservabilityPlugin} from "../local/localPlugin";
import {registerObsSpan} from "../local/models/obsSpan";
import {registerObsTrace} from "../local/models/obsTrace";
import {ObservabilityApp, resetObservabilityApp} from "../observabilityApp";
import type {ObservabilityGenerateClient, SpanKind} from "../types";

const createFakeAiService = (
  behavior: Partial<ObservabilityGenerateClient> & {
    failOn?: string;
  } = {}
): ObservabilityGenerateClient => {
  return {
    generateJsonObject: async () => ({}) as never,
    generateText: mock(async ({systemPrompt}) => {
      if (behavior.failOn && systemPrompt?.includes(behavior.failOn)) {
        throw new Error(`failed on ${behavior.failOn}`);
      }
      if (systemPrompt?.includes("Summarize the user input")) {
        return "alpha phrase";
      }
      if (systemPrompt?.includes("List two keywords")) {
        return "beta, gamma";
      }
      if (systemPrompt?.includes("Combine the stage-one phrase")) {
        return "combined output";
      }
      return "unexpected";
    }),
    modelId: "fake-observability-model",
    ...behavior,
  };
};

const flattenKinds = (nodes: Array<{children: unknown[]; kind: SpanKind}>): SpanKind[] => {
  const kinds: SpanKind[] = [];
  for (const node of nodes) {
    kinds.push(node.kind);
    kinds.push(...flattenKinds(node.children as Array<{children: unknown[]; kind: SpanKind}>));
  }
  return kinds;
};

describe("observability test-multi-stage route", () => {
  let app: express.Application;
  let fakeAiService: ObservabilityGenerateClient;

  beforeAll(async () => {
    await ensureTestUsers();
  });

  afterEach(() => {
    resetObservabilityApp();
  });

  beforeEach(async () => {
    await registerObsTrace().deleteMany({});
    await registerObsSpan().deleteMany({});
    const plugin = createLocalObservabilityPlugin();
    fakeAiService = createFakeAiService();
    app = new TerrenoApp({skipListen: true, userModel: UserModel})
      .register(new ObservabilityApp({aiService: fakeAiService, plugins: [plugin]}))
      .build();
  });

  it("runs the workflow, exports one nested trace, and returns trace detail", async () => {
    const agent = await authAsUser(app, "admin");
    const res = await agent.post("/ai/observability/traces/test-multi-stage").send({
      input: "Terreno observability smoke input",
    });
    expect(res.status).toBe(200);
    assert.isString(res.body.data.traceId);
    assert.equal(res.body.data.output, "combined output");
    assert.equal(res.body.data.stages.length, 4);

    const detail = await agent.get(`/ai/observability/traces/${res.body.data.traceId}`);
    expect(detail.status).toBe(200);
    assert.equal(detail.body.data.name, "test-multi-stage");
    assert.equal(flattenKinds(detail.body.data.spans).join(","), "CHAIN,LLM,LLM,TOOL,LLM");
    assert.equal(detail.body.data.spans[0].children[0].parentSpanId, detail.body.data.spans[0].id);
    assert.equal(detail.body.data.output, "combined output");
  });

  it("returns 403 for non-admin callers", async () => {
    const agent = await authAsUser(app, "notAdmin");
    const res = await agent.post("/ai/observability/traces/test-multi-stage").send({
      input: "blocked",
    });
    expect(res.status).toBe(403);
  });

  it("returns 503 when aiService is not configured", async () => {
    const plugin = createLocalObservabilityPlugin();
    const noAiApp = new TerrenoApp({skipListen: true, userModel: UserModel})
      .register(new ObservabilityApp({plugins: [plugin]}))
      .build();
    const agent = await authAsUser(noAiApp, "admin");
    const res = await agent.post("/ai/observability/traces/test-multi-stage").send({
      input: "missing service",
    });
    expect(res.status).toBe(503);
  });

  it("exports an error trace and rethrows when a child LLM stage fails", async () => {
    const failingService = createFakeAiService({failOn: "List two keywords"});
    const plugin = createLocalObservabilityPlugin();
    const failingApp = new TerrenoApp({skipListen: true, userModel: UserModel})
      .register(new ObservabilityApp({aiService: failingService, plugins: [plugin]}))
      .build();
    const agent = await authAsUser(failingApp, "admin");
    const res = await agent.post("/ai/observability/traces/test-multi-stage").send({
      input: "fail on second stage",
    });
    expect(res.status).toBe(500);

    const listed = await agent.get("/ai/observability/traces?status=error&limit=5");
    expect(listed.status).toBe(200);
    assert.isAtLeast(listed.body.data.length, 1);
    const traceId = listed.body.data[0].id as string;
    const detail = await agent.get(`/ai/observability/traces/${traceId}`);
    assert.equal(detail.body.data.status, "error");
    const childKinds = flattenKinds(detail.body.data.spans);
    assert.include(childKinds, "LLM");
    assert.equal(childKinds.filter((kind) => kind === "LLM").length, 2);
    const failedSpan = detail.body.data.spans[0].children.find(
      (span: {name: string; status: string}) => span.name === "call-2"
    );
    assert.equal(failedSpan?.status, "error");
  });
});
