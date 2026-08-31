import {afterEach, beforeAll, beforeEach, describe, expect, it} from "bun:test";
import {TerrenoApp} from "@terreno/api";
import type express from "express";

import {authAsUser, ensureTestUsers, UserModel} from "../../tests/helpers";
import {createLocalObservabilityPlugin} from "../local/localPlugin";
import {registerObsEvaluator} from "../local/models/obsEvaluator";
import {ObservabilityApp, resetObservabilityApp} from "../observabilityApp";

describe("observability evaluator routes", () => {
  let app: express.Application;

  beforeAll(async () => {
    await ensureTestUsers();
  });

  afterEach(() => {
    resetObservabilityApp();
  });

  beforeEach(async () => {
    await registerObsEvaluator().deleteMany({});
    app = new TerrenoApp({skipListen: true, userModel: UserModel})
      .register(new ObservabilityApp({plugins: [createLocalObservabilityPlugin()]}))
      .build();
  });

  it("installs a template by name and rejects human live sampling", async () => {
    const agent = await authAsUser(app, "admin");
    const templates = await agent.get("/ai/observability/evaluators/templates");
    expect(templates.status).toBe(200);
    expect(templates.body.data.some((row: {name: string}) => row.name === "correctness")).toBe(
      true
    );

    const installed = await agent.post("/ai/observability/evaluators/templates/correctness");
    expect(installed.status).toBe(201);
    expect(installed.body.data.name).toBe("correctness");

    const live = await agent.post("/ai/observability/evaluators").send({
      dimensions: [{dataType: "boolean", key: "correct", required: true}],
      name: "live-human",
      runModes: {allowManualRun: true, availableInExperiments: true, liveSampleRate: 10},
      target: "full trace",
      type: "human",
    });
    expect(live.status).toBe(400);
  });
});
