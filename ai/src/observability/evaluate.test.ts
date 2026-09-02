import {afterEach, beforeEach, describe, it} from "bun:test";
import {assert} from "chai";
import {
  judgeSchemaMissingDimensions,
  runEvaluator,
  runJsonAssertEvaluator,
  runLlmJudgeEvaluator,
} from "./evaluate";
import {createLocalObservabilityBundle} from "./local/localPlugin";
import {registerObsEvaluator} from "./local/models/obsEvaluator";
import {registerObsPrompt} from "./local/models/obsPrompt";
import {registerObsPromptLabel} from "./local/models/obsPromptLabel";
import {registerObsPromptVersion} from "./local/models/obsPromptVersion";
import {LocalPromptStore} from "./local/promptStore";
import {ObservabilityApp, resetObservabilityApp} from "./observabilityApp";

const clearObsPrompts = async (): Promise<void> => {
  await registerObsPromptLabel().deleteMany({});
  await registerObsPromptVersion().deleteMany({});
  await registerObsPrompt().deleteMany({});
};

describe("evaluate", () => {
  let promptStore: LocalPromptStore;

  beforeEach(async () => {
    createLocalObservabilityBundle();
    promptStore = new LocalPromptStore();
    await registerObsEvaluator().deleteMany({});
    await clearObsPrompts();
    await promptStore.create({
      folder: "eval",
      name: "eval-judge-correctness",
      outputSchema: {
        properties: {
          confidence: {type: "number"},
          correct: {type: "boolean"},
        },
        required: ["correct"],
        type: "object",
      },
      system: "Judge correctness",
      type: "text",
    });
    await promptStore.moveLabel("eval-judge-correctness", {label: "production", version: 1});
  });

  afterEach(() => {
    resetObservabilityApp();
  });

  it("records json-assert schema failures without throwing", () => {
    const result = runJsonAssertEvaluator({
      evaluator: {
        dimensions: [{dataType: "boolean", key: "schema_valid", required: true}],
        name: "schema-assert",
        type: "json-assert",
      },
      input: {text: "hi"},
      output: {wrong: true},
      outputSchema: {
        properties: {answer: {type: "string"}},
        required: ["answer"],
        type: "object",
      },
    });
    assert.equal(result.scores?.schema_valid, false);
    assert.include(result.error ?? "", "/");
  });

  it("evaluates path constraints", () => {
    const result = runJsonAssertEvaluator({
      evaluator: {
        assertion: {constraint: "eq:true", path: "ok"},
        dimensions: [{dataType: "boolean", key: "matches", required: true}],
        name: "path-assert",
        type: "json-assert",
      },
      input: {},
      output: {ok: true},
    });
    assert.equal(result.scores?.matches, true);
  });

  it("writes declared llm-judge keys and confidence", async () => {
    const result = await runLlmJudgeEvaluator(
      {
        evaluator: {
          dimensions: [{dataType: "boolean", key: "correct", required: true}],
          judgePromptName: "eval-judge-correctness",
          name: "correctness",
          type: "llm-judge",
        },
        input: {question: "2+2"},
        output: "4",
      },
      {
        generateJsonObject: async () => {
          return {confidence: 0.95, correct: true};
        },
      },
      {
        properties: {
          confidence: {type: "number"},
          correct: {type: "boolean"},
        },
        required: ["correct"],
        type: "object",
      }
    );
    assert.deepEqual(result.scores, {correct: true});
    assert.equal(result.confidence, 0.95);
  });

  it("returns an error outcome when judge generation fails", async () => {
    const result = await runEvaluator(
      {
        evaluator: {
          dimensions: [{dataType: "boolean", key: "correct", required: true}],
          judgePromptName: "eval-judge-correctness",
          name: "correctness",
          type: "llm-judge",
        },
        input: {},
        output: "nope",
      },
      {
        ai: {
          generateJsonObject: async () => {
            throw new Error("model blew up");
          },
        },
        judgeOutputSchema: {
          properties: {correct: {type: "boolean"}},
          type: "object",
        },
      }
    );
    assert.equal(result.error, "model blew up");
    assert.isUndefined(result.scores);
  });

  it("names missing judge schema dimensions", () => {
    const missing = judgeSchemaMissingDimensions(
      [{dataType: "boolean", key: "correct", required: true}],
      {properties: {helpfulness: {type: "number"}}, type: "object"}
    );
    assert.deepEqual(missing, ["correct"]);
  });
});

describe("LocalEvaluatorStore phase 2", () => {
  let promptStore: LocalPromptStore;
  let store: import("./local/evaluatorStore").LocalEvaluatorStore;

  beforeEach(async () => {
    new ObservabilityApp({plugins: [createLocalObservabilityBundle().plugin]});
    promptStore = new LocalPromptStore();
    store = new (await import("./local/evaluatorStore")).LocalEvaluatorStore(promptStore);
    await registerObsEvaluator().deleteMany({});
    await clearObsPrompts();
    await promptStore.create({
      folder: "eval",
      name: "eval-judge-correctness",
      outputSchema: {
        properties: {correct: {type: "boolean"}},
        required: ["correct"],
        type: "object",
      },
      system: "Judge",
      type: "text",
    });
    await promptStore.moveLabel("eval-judge-correctness", {label: "production", version: 1});
  });

  afterEach(() => {
    resetObservabilityApp();
  });

  it("rejects a judge whose schema omits a required dimension", async () => {
    try {
      await store.create({
        dimensions: [
          {dataType: "boolean", key: "correct", required: true},
          {dataType: "boolean", key: "grounded", required: true},
        ],
        judgePromptName: "eval-judge-correctness",
        name: "strict-judge",
        target: "generation span",
        type: "llm-judge",
      });
      assert.fail("expected schema mismatch");
    } catch (error) {
      assert.match(String(error), /grounded/);
    }
  });

  it("defaults confidenceAlertBelow to 0.7", async () => {
    const created = await store.create({
      dimensions: [{dataType: "boolean", key: "schema_valid", required: true}],
      name: "schema-assert",
      target: "generation span",
      type: "json-assert",
    });
    assert.equal(created.confidenceAlertBelow, 0.7);
  });

  it("installs llm-judge and human templates", async () => {
    const judge = await store.installTemplate("correctness");
    assert.equal(judge.type, "llm-judge");
    const human = await store.installTemplate("correctness-human");
    assert.equal(human.type, "human");
    const schemaAssert = await store.installTemplate("schema-assert");
    assert.equal(schemaAssert.type, "json-assert");
  });
});
