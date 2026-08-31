import {afterEach, beforeAll, beforeEach, describe, expect, it} from "bun:test";
import {TerrenoApp} from "@terreno/api";
import type express from "express";
import {DateTime} from "luxon";

import {authAsUser, ensureTestUsers, UserModel} from "../../tests/helpers";
import {LocalEvaluatorStore} from "../local/evaluatorStore";
import {createLocalObservabilityPlugin} from "../local/localPlugin";
import {registerObsEvaluator} from "../local/models/obsEvaluator";
import {registerObsReviewItem} from "../local/models/obsReviewItem";
import {registerObsTrace} from "../local/models/obsTrace";
import {LocalTraceStore} from "../local/traceStore";
import {ObservabilityApp, resetObservabilityApp} from "../observabilityApp";

describe("observability review routes", () => {
  let app: express.Application;

  beforeAll(async () => {
    await ensureTestUsers();
  });

  afterEach(() => {
    resetObservabilityApp();
  });

  beforeEach(async () => {
    await registerObsReviewItem().deleteMany({});
    await registerObsEvaluator().deleteMany({});
    await registerObsTrace().deleteMany({});
    app = new TerrenoApp({skipListen: true, userModel: UserModel})
      .register(new ObservabilityApp({plugins: [createLocalObservabilityPlugin()]}))
      .build();
  });

  it("enqueues a trace and lists it pending oldest-first", async () => {
    const evaluator = await new LocalEvaluatorStore().create({
      dimensions: [{dataType: "boolean", key: "correct", required: true}],
      name: "queue-human",
      target: "full trace",
      type: "human",
    });
    const trace = await new LocalTraceStore().exportTrace({
      id: "t",
      name: "gen",
      prompts: [{name: "summarize", version: 1}],
      sensitive: false,
      spans: [
        {
          id: "s",
          kind: "LLM",
          name: "llm",
          startedAt: DateTime.utc().toISO() ?? "",
          status: "ok",
        },
      ],
      startedAt: DateTime.utc().toISO() ?? "",
      status: "ok",
    });
    const agent = await authAsUser(app, "admin");
    const enqueued = await agent.post("/ai/observability/traces/review").send({
      evaluatorId: evaluator.id,
      reason: "manual",
      traceIds: [trace.id],
    });
    expect(enqueued.status).toBe(201);
    const listed = await agent.get("/ai/observability/review?status=pending");
    expect(listed.status).toBe(200);
    expect(listed.body.counts.pending).toBe(1);
    expect(listed.body.data[0].traceId).toBe(trace.id);
  });
});
