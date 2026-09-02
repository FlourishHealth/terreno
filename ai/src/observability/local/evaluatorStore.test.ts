import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {EVALUATOR_TEMPLATES} from "../evaluatorTemplates";
import {ObservabilityApp, resetObservabilityApp} from "../observabilityApp";
import {LocalEvaluatorStore} from "./evaluatorStore";
import {createLocalObservabilityPlugin} from "./localPlugin";
import {registerObsEvaluator} from "./models/obsEvaluator";

describe("LocalEvaluatorStore", () => {
  let store: LocalEvaluatorStore;

  afterEach(() => {
    resetObservabilityApp();
  });

  beforeEach(async () => {
    new ObservabilityApp({plugins: [createLocalObservabilityPlugin()]});
    store = new LocalEvaluatorStore();
    await registerObsEvaluator().deleteMany({});
  });

  it("persists numeric, boolean, and categorical dimensions", async () => {
    const created = await store.create({
      dimensions: [
        {dataType: "numeric", key: "helpfulness", range: "0-1", required: true},
        {dataType: "boolean", key: "correct", required: true},
        {dataType: "categorical", key: "tone", range: "warm|neutral|cold", required: false},
      ],
      instructions: "Score the generation.",
      name: "review-pack",
      runModes: {allowManualRun: true, availableInExperiments: true, liveSampleRate: 0},
      target: "full trace",
      type: "human",
    });
    const loaded = await store.get(created.id);
    expect(loaded.dimensions.map((row) => row.dataType)).toEqual([
      "numeric",
      "boolean",
      "categorical",
    ]);
    expect(loaded.confidenceAlertBelow).toBe(0.7);
  });

  it("rejects a human evaluator with live sampling", async () => {
    await expect(
      store.create({
        dimensions: [{dataType: "boolean", key: "correct", required: true}],
        name: "live-human",
        runModes: {allowManualRun: true, availableInExperiments: true, liveSampleRate: 5},
        target: "generation span",
        type: "human",
      })
    ).rejects.toThrow(/liveSampleRate/);
  });

  it("installs a seeded template by name", async () => {
    expect(EVALUATOR_TEMPLATES.some((row) => row.name === "correctness-human")).toBe(true);
    const installed = await store.installTemplate("correctness-human");
    expect(installed.name).toBe("correctness-human");
    expect(installed.type).toBe("human");
    expect(installed.dimensions[0]?.dataType).toBe("boolean");
  });
});
