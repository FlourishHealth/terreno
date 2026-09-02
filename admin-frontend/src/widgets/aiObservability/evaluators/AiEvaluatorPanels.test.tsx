import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import {
  AiEvaluatorDetailView,
  AiEvaluatorNewView,
  defaultEvaluatorRunModes,
  initialNewEvaluatorDimensions,
} from "./AiEvaluatorPanels";
import {judgeSchemaMissingDimensions} from "./evaluatorTypes";

describe("AiEvaluatorNewView schema mismatch", () => {
  it("shows the undeclared dimension key inline for llm-judge", () => {
    const missing = judgeSchemaMissingDimensions(
      [{dataType: "boolean", key: "correct", required: true}],
      {properties: {quality: {type: "number"}}}
    );
    assert.deepEqual(missing, ["correct"]);

    const {getByTestId} = renderWithTheme(
      <AiEvaluatorNewView
        assertionConstraint="exists"
        assertionPath="output"
        dimensions={[{dataType: "boolean", key: "correct", required: true}]}
        instructions=""
        isCreating={false}
        judgePromptName="judge"
        name="quality"
        onAddDimension={() => undefined}
        onAssertionConstraintChange={() => undefined}
        onAssertionPathChange={() => undefined}
        onCreate={() => undefined}
        onDimensionChange={() => undefined}
        onInstructionsChange={() => undefined}
        onJudgePromptNameChange={() => undefined}
        onLiveSampleRateChange={() => undefined}
        onNameChange={() => undefined}
        onRemoveDimension={() => undefined}
        onTargetChange={() => undefined}
        onTypeChange={() => undefined}
        runModes={{allowManualRun: true, availableInExperiments: true, liveSampleRate: 0}}
        schemaMismatchKey={missing[0]}
        target="full trace"
        type="llm-judge"
      />
    );
    expect(getByTestId("ai-evaluator-schema-mismatch").props.children).toContain("correct");
  });
});

describe("AiEvaluatorNewView panels", () => {
  it("renders human instructions panel", () => {
    const {getByTestId} = renderWithTheme(
      <AiEvaluatorNewView
        assertionConstraint="exists"
        assertionPath=""
        dimensions={[{dataType: "boolean", key: "pass", required: true}]}
        instructions="Rate quality"
        isCreating={false}
        judgePromptName=""
        name="human-review"
        onAddDimension={() => undefined}
        onAssertionConstraintChange={() => undefined}
        onAssertionPathChange={() => undefined}
        onCreate={() => undefined}
        onDimensionChange={() => undefined}
        onInstructionsChange={() => undefined}
        onJudgePromptNameChange={() => undefined}
        onLiveSampleRateChange={() => undefined}
        onNameChange={() => undefined}
        onRemoveDimension={() => undefined}
        onTargetChange={() => undefined}
        onTypeChange={() => undefined}
        runModes={{allowManualRun: true, availableInExperiments: true, liveSampleRate: 0}}
        target="full trace"
        type="human"
      />
    );
    expect(getByTestId("ai-evaluator-panel-human")).toBeTruthy();
  });

  it("renders json-assert panel", () => {
    const {getByTestId} = renderWithTheme(
      <AiEvaluatorNewView
        assertionConstraint="exists"
        assertionPath="output.text"
        dimensions={[{dataType: "boolean", key: "pass", required: true}]}
        instructions=""
        isCreating={false}
        judgePromptName=""
        name="assert"
        onAddDimension={() => undefined}
        onAssertionConstraintChange={() => undefined}
        onAssertionPathChange={() => undefined}
        onCreate={() => undefined}
        onDimensionChange={() => undefined}
        onInstructionsChange={() => undefined}
        onJudgePromptNameChange={() => undefined}
        onLiveSampleRateChange={() => undefined}
        onNameChange={() => undefined}
        onRemoveDimension={() => undefined}
        onTargetChange={() => undefined}
        onTypeChange={() => undefined}
        runModes={{allowManualRun: true, availableInExperiments: true, liveSampleRate: 0}}
        target="generation span"
        type="json-assert"
      />
    );
    expect(getByTestId("ai-evaluator-panel-json-assert")).toBeTruthy();
  });

  it("wires new-evaluator controls for dimensions, targets, and run modes", async () => {
    const onTypeChange = mock(() => undefined);
    const onTargetChange = mock(() => undefined);
    const onAddDimension = mock(() => undefined);
    const onRemoveDimension = mock(() => undefined);
    const onLiveSampleRateChange = mock(() => undefined);
    const onCreate = mock(() => undefined);
    const {getByTestId, getAllByText, getByText} = renderWithTheme(
      <AiEvaluatorNewView
        assertionConstraint="exists"
        assertionPath="output"
        createError="Name taken"
        dimensions={[
          {dataType: "boolean", key: "pass", required: true},
          {dataType: "numeric", key: "score", range: "0-1", required: false},
        ]}
        instructions=""
        isCreating={false}
        judgePromptName=""
        name="assert"
        onAddDimension={onAddDimension}
        onAssertionConstraintChange={() => undefined}
        onAssertionPathChange={() => undefined}
        onCreate={onCreate}
        onDimensionChange={() => undefined}
        onInstructionsChange={() => undefined}
        onJudgePromptNameChange={() => undefined}
        onLiveSampleRateChange={onLiveSampleRateChange}
        onNameChange={() => undefined}
        onRemoveDimension={onRemoveDimension}
        onTargetChange={onTargetChange}
        onTypeChange={onTypeChange}
        runModes={{allowManualRun: true, availableInExperiments: true, liveSampleRate: 5}}
        target="full trace"
        type="json-assert"
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("ai-evaluator-type-llm-judge"));
      fireEvent.press(getByTestId("ai-evaluator-target-generation-span"));
      fireEvent.press(getByTestId("ai-evaluator-add-dimension"));
      const removeButtons = getAllByText("Remove");
      if (removeButtons.length > 0) {
        fireEvent.press(removeButtons[removeButtons.length - 1]!);
      }
      fireEvent.changeText(getByTestId("ai-evaluator-live-sample"), "25");
      fireEvent.press(getByTestId("ai-evaluator-submit"));
      await Promise.resolve();
    });
    expect(getByTestId("ai-evaluator-create-error")).toBeTruthy();
    expect(getByText(/Live sampling bills judge calls/)).toBeTruthy();
  });
});

describe("AiEvaluatorDetailView", () => {
  it("renders dimensions, llm-judge config, and 30-day usage table", () => {
    const onOpenPrompt = mock(() => undefined);
    const {getByTestId, getByText} = renderWithTheme(
      <AiEvaluatorDetailView
        evaluator={{
          dimensions: [{dataType: "boolean", key: "correct", required: true}],
          id: "eval-1",
          judgePromptName: "judge",
          name: "quality",
          runModes: {allowManualRun: true, availableInExperiments: true, liveSampleRate: 10},
          target: "full trace",
          type: "llm-judge",
        }}
        judgeOutputSchema={{properties: {correct: {type: "boolean"}}}}
        onOpenPrompt={onOpenPrompt}
        routeBase="/admin"
        usageRows={[{costUsd: 1.2, experimentName: "compare", runs: 3}]}
      />
    );
    expect(getByTestId("ai-evaluator-detail")).toBeTruthy();
    expect(getByTestId("ai-evaluator-dimensions")).toBeTruthy();
    expect(getByTestId("ai-evaluator-panel-llm-judge")).toBeTruthy();
    expect(getByTestId("ai-evaluator-used-by")).toBeTruthy();
    expect(getByText("judge")).toBeTruthy();
  });

  it("shows human and json-assert detail panels with empty usage", () => {
    const human = renderWithTheme(
      <AiEvaluatorDetailView
        evaluator={{
          dimensions: [{dataType: "boolean", key: "pass", required: true}],
          id: "eval-2",
          instructions: "Rate quality",
          name: "human",
          runModes: {allowManualRun: true, availableInExperiments: false, liveSampleRate: 0},
          target: "full trace",
          type: "human",
        }}
        onOpenPrompt={() => undefined}
        routeBase="/admin"
        usageRows={[]}
      />
    );
    expect(human.getByTestId("ai-evaluator-panel-human")).toBeTruthy();

    const jsonAssert = renderWithTheme(
      <AiEvaluatorDetailView
        evaluator={{
          assertionConstraint: "exists",
          assertionPath: "output.text",
          dimensions: [{dataType: "boolean", key: "pass", required: true}],
          id: "eval-3",
          name: "assert",
          runModes: {allowManualRun: true, availableInExperiments: true, liveSampleRate: 0},
          target: "generation span",
          type: "json-assert",
        }}
        onOpenPrompt={() => undefined}
        routeBase="/admin"
        usageRows={[]}
      />
    );
    expect(jsonAssert.getByTestId("ai-evaluator-panel-json-assert")).toBeTruthy();
    expect(jsonAssert.getByTestId("ai-evaluator-used-by-empty")).toBeTruthy();
  });

  it("renders judge link without onOpenPrompt and empty judge prompt", () => {
    const noPrompt = renderWithTheme(
      <AiEvaluatorDetailView
        evaluator={{
          dimensions: [{dataType: "boolean", key: "correct", required: true}],
          id: "eval-4",
          name: "quality",
          runModes: {allowManualRun: true, availableInExperiments: true, liveSampleRate: 0},
          target: "full trace",
          type: "llm-judge",
        }}
        routeBase="/admin"
        usageRows={[]}
      />
    );
    expect(noPrompt.getByText("—")).toBeTruthy();

    const withLink = renderWithTheme(
      <AiEvaluatorDetailView
        evaluator={{
          dimensions: [{dataType: "boolean", key: "correct", required: true}],
          id: "eval-5",
          judgePromptName: "judge",
          name: "quality",
          runModes: {allowManualRun: true, availableInExperiments: true, liveSampleRate: 0},
          target: "full trace",
          type: "llm-judge",
        }}
        routeBase="/admin"
        usageRows={[]}
      />
    );
    expect(withLink.getByText("judge")).toBeTruthy();
  });

  it("opens judge prompt via onOpenPrompt and shows schema match", async () => {
    const onOpenPrompt = mock(() => undefined);
    const {getByText} = renderWithTheme(
      <AiEvaluatorDetailView
        evaluator={{
          dimensions: [{dataType: "boolean", key: "correct", required: true}],
          id: "eval-1",
          judgePromptName: "judge",
          name: "quality",
          runModes: {allowManualRun: true, availableInExperiments: true, liveSampleRate: 0},
          target: "full trace",
          type: "llm-judge",
        }}
        judgeOutputSchema={{properties: {correct: {type: "boolean"}}}}
        onOpenPrompt={onOpenPrompt}
        routeBase="/admin"
        usageRows={[{costUsd: undefined, experimentName: "compare", runs: 1}]}
      />
    );
    await act(async () => {
      fireEvent.press(getByText("judge"));
      await Promise.resolve();
    });
    assert.equal(onOpenPrompt.mock.calls.length, 1);
    expect(getByText("Schema match check passed")).toBeTruthy();
  });

  it("shows schema mismatch and missing human instructions on detail", () => {
    const mismatch = renderWithTheme(
      <AiEvaluatorDetailView
        evaluator={{
          dimensions: [{dataType: "boolean", key: "correct", required: true}],
          id: "eval-6",
          judgePromptName: "judge",
          name: "quality",
          runModes: {allowManualRun: true, availableInExperiments: true, liveSampleRate: 0},
          target: "full trace",
          type: "llm-judge",
        }}
        judgeOutputSchema={{properties: {quality: {type: "number"}}}}
        routeBase="/admin"
        usageRows={[]}
      />
    );
    expect(mismatch.getByTestId("ai-evaluator-schema-mismatch")).toBeTruthy();

    const human = renderWithTheme(
      <AiEvaluatorDetailView
        evaluator={{
          dimensions: [{dataType: "boolean", key: "pass", required: true}],
          id: "eval-7",
          name: "human",
          runModes: {allowManualRun: true, availableInExperiments: false, liveSampleRate: 0},
          target: "full trace",
          type: "human",
        }}
        routeBase="/admin"
        usageRows={[]}
      />
    );
    expect(human.getByText("No reviewer instructions.")).toBeTruthy();
  });
});

describe("AiEvaluatorNewView dimension editing", () => {
  it("wires dimension key, type, range, and remove handlers", async () => {
    const onDimensionChange = mock(() => undefined);
    const onRemoveDimension = mock(() => undefined);
    const {getAllByDisplayValue, getAllByText} = renderWithTheme(
      <AiEvaluatorNewView
        assertionConstraint="exists"
        assertionPath="output"
        dimensions={[
          {dataType: "boolean", key: "pass", required: true},
          {dataType: "boolean", key: "extra", required: false},
        ]}
        instructions=""
        isCreating={false}
        judgePromptName=""
        name="assert"
        onAddDimension={() => undefined}
        onAssertionConstraintChange={() => undefined}
        onAssertionPathChange={() => undefined}
        onCreate={() => undefined}
        onDimensionChange={onDimensionChange}
        onInstructionsChange={() => undefined}
        onJudgePromptNameChange={() => undefined}
        onLiveSampleRateChange={() => undefined}
        onNameChange={() => undefined}
        onRemoveDimension={onRemoveDimension}
        onTargetChange={() => undefined}
        onTypeChange={() => undefined}
        runModes={{allowManualRun: true, availableInExperiments: true, liveSampleRate: 0}}
        target="full trace"
        type="json-assert"
      />
    );
    fireEvent.changeText(getAllByDisplayValue("pass")[0]!, "score");
    const numericButtons = getAllByText("numeric");
    await act(async () => {
      fireEvent.press(numericButtons[0]!);
      const removeButtons = getAllByText("Remove");
      fireEvent.press(removeButtons[removeButtons.length - 1]!);
      await Promise.resolve();
    });
    assert.isAtLeast(onDimensionChange.mock.calls.length, 1);
    assert.isAtLeast(onRemoveDimension.mock.calls.length, 1);
  });

  it("wires assertion, instructions, judge prompt, and range fields", async () => {
    const onAssertionPathChange = mock(() => undefined);
    const onAssertionConstraintChange = mock(() => undefined);
    const onInstructionsChange = mock(() => undefined);
    const onJudgePromptNameChange = mock(() => undefined);
    const onDimensionChange = mock(() => undefined);
    const llmJudge = renderWithTheme(
      <AiEvaluatorNewView
        assertionConstraint="exists"
        assertionPath="output"
        dimensions={[{dataType: "boolean", key: "correct", required: false}]}
        instructions=""
        isCreating={false}
        judgePromptName="judge"
        name="quality"
        onAddDimension={() => undefined}
        onAssertionConstraintChange={onAssertionConstraintChange}
        onAssertionPathChange={onAssertionPathChange}
        onCreate={() => undefined}
        onDimensionChange={onDimensionChange}
        onInstructionsChange={onInstructionsChange}
        onJudgePromptNameChange={onJudgePromptNameChange}
        onLiveSampleRateChange={() => undefined}
        onNameChange={() => undefined}
        onRemoveDimension={() => undefined}
        onTargetChange={() => undefined}
        onTypeChange={() => undefined}
        runModes={{allowManualRun: true, availableInExperiments: true, liveSampleRate: 0}}
        target="full trace"
        type="llm-judge"
      />
    );
    fireEvent.changeText(llmJudge.getByTestId("ai-evaluator-judge-prompt"), "judge-v2");
    assert.isAtLeast(onJudgePromptNameChange.mock.calls.length, 1);
    expect(llmJudge.getByText("Schema match check passed")).toBeTruthy();

    const human = renderWithTheme(
      <AiEvaluatorNewView
        assertionConstraint="exists"
        assertionPath="output"
        dimensions={[{dataType: "boolean", key: "pass", required: true}]}
        instructions="Rate quality"
        isCreating={false}
        judgePromptName=""
        name="human-review"
        onAddDimension={() => undefined}
        onAssertionConstraintChange={onAssertionConstraintChange}
        onAssertionPathChange={onAssertionPathChange}
        onCreate={() => undefined}
        onDimensionChange={onDimensionChange}
        onInstructionsChange={onInstructionsChange}
        onJudgePromptNameChange={onJudgePromptNameChange}
        onLiveSampleRateChange={() => undefined}
        onNameChange={() => undefined}
        onRemoveDimension={() => undefined}
        onTargetChange={() => undefined}
        onTypeChange={() => undefined}
        runModes={{allowManualRun: true, availableInExperiments: true, liveSampleRate: 0}}
        target="full trace"
        type="human"
      />
    );
    fireEvent.changeText(human.getByTestId("ai-evaluator-instructions"), "Be strict");
    assert.isAtLeast(onInstructionsChange.mock.calls.length, 1);

    const jsonAssert = renderWithTheme(
      <AiEvaluatorNewView
        assertionConstraint="exists"
        assertionPath="output.text"
        dimensions={[{dataType: "numeric", key: "score", range: "0-1", required: true}]}
        instructions=""
        isCreating={false}
        judgePromptName=""
        name="assert"
        onAddDimension={() => undefined}
        onAssertionConstraintChange={onAssertionConstraintChange}
        onAssertionPathChange={onAssertionPathChange}
        onCreate={() => undefined}
        onDimensionChange={onDimensionChange}
        onInstructionsChange={onInstructionsChange}
        onJudgePromptNameChange={onJudgePromptNameChange}
        onLiveSampleRateChange={() => undefined}
        onNameChange={() => undefined}
        onRemoveDimension={() => undefined}
        onTargetChange={() => undefined}
        onTypeChange={() => undefined}
        runModes={{allowManualRun: true, availableInExperiments: true, liveSampleRate: 0}}
        target="full trace"
        type="json-assert"
      />
    );
    fireEvent.changeText(jsonAssert.getByTestId("ai-evaluator-assertion-path"), "output.score");
    fireEvent.changeText(jsonAssert.getByTestId("ai-evaluator-assertion-constraint"), "gte 0.8");
    fireEvent.changeText(jsonAssert.getAllByDisplayValue("0-1")[0]!, "0-10");
    assert.isAtLeast(onAssertionPathChange.mock.calls.length, 1);
    assert.isAtLeast(onAssertionConstraintChange.mock.calls.length, 1);
    assert.isAtLeast(onDimensionChange.mock.calls.length, 1);
  });
});

describe("AiEvaluatorNewView type and live sample controls", () => {
  it("selects each dimension data type and ignores invalid live sample input", async () => {
    const onTypeChange = mock(() => undefined);
    const onDimensionChange = mock(() => undefined);
    const onLiveSampleRateChange = mock(() => undefined);
    const {getAllByText, getByTestId} = renderWithTheme(
      <AiEvaluatorNewView
        assertionConstraint="exists"
        assertionPath="output"
        dimensions={[{dataType: "boolean", key: "pass", required: true}]}
        instructions=""
        isCreating={false}
        judgePromptName=""
        name="assert"
        onAddDimension={() => undefined}
        onAssertionConstraintChange={() => undefined}
        onAssertionPathChange={() => undefined}
        onCreate={() => undefined}
        onDimensionChange={onDimensionChange}
        onInstructionsChange={() => undefined}
        onJudgePromptNameChange={() => undefined}
        onLiveSampleRateChange={onLiveSampleRateChange}
        onNameChange={() => undefined}
        onRemoveDimension={() => undefined}
        onTargetChange={() => undefined}
        onTypeChange={onTypeChange}
        runModes={{allowManualRun: true, availableInExperiments: true, liveSampleRate: 0}}
        target="full trace"
        type="json-assert"
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("ai-evaluator-type-human"));
      fireEvent.press(getByTestId("ai-evaluator-type-json-assert"));
      fireEvent.press(getAllByText("numeric")[0]!);
      fireEvent.press(getAllByText("categorical")[0]!);
      await Promise.resolve();
    });
    assert.isAtLeast(onTypeChange.mock.calls.length, 2);
    assert.isAtLeast(onDimensionChange.mock.calls.length, 2);
    const beforeInvalid = onLiveSampleRateChange.mock.calls.length;
    fireEvent.changeText(getByTestId("ai-evaluator-live-sample"), "not-a-number");
    assert.equal(onLiveSampleRateChange.mock.calls.length, beforeInvalid);
    fireEvent.changeText(getByTestId("ai-evaluator-live-sample"), "150");
    assert.isAbove(onLiveSampleRateChange.mock.calls.length, beforeInvalid);
  });

  it("invokes optional panel onChange fallbacks when handlers are omitted", () => {
    const noop = undefined as unknown as (value: string) => void;
    const llmJudge = renderWithTheme(
      <AiEvaluatorNewView
        assertionConstraint="exists"
        assertionPath="output"
        dimensions={[{dataType: "boolean", key: "pass", required: true}]}
        instructions=""
        isCreating={false}
        judgePromptName=""
        name="quality"
        onAddDimension={() => undefined}
        onAssertionConstraintChange={noop}
        onAssertionPathChange={noop}
        onCreate={() => undefined}
        onDimensionChange={() => undefined}
        onInstructionsChange={noop}
        onJudgePromptNameChange={noop}
        onLiveSampleRateChange={() => undefined}
        onNameChange={() => undefined}
        onRemoveDimension={() => undefined}
        onTargetChange={() => undefined}
        onTypeChange={() => undefined}
        runModes={{allowManualRun: true, availableInExperiments: true, liveSampleRate: 0}}
        target="full trace"
        type="llm-judge"
      />
    );
    fireEvent.changeText(llmJudge.getByTestId("ai-evaluator-judge-prompt"), "judge");

    const human = renderWithTheme(
      <AiEvaluatorNewView
        assertionConstraint="exists"
        assertionPath="output"
        dimensions={[{dataType: "boolean", key: "pass", required: true}]}
        instructions=""
        isCreating={false}
        judgePromptName=""
        name="human-review"
        onAddDimension={() => undefined}
        onAssertionConstraintChange={noop}
        onAssertionPathChange={noop}
        onCreate={() => undefined}
        onDimensionChange={() => undefined}
        onInstructionsChange={noop}
        onJudgePromptNameChange={noop}
        onLiveSampleRateChange={() => undefined}
        onNameChange={() => undefined}
        onRemoveDimension={() => undefined}
        onTargetChange={() => undefined}
        onTypeChange={() => undefined}
        runModes={{allowManualRun: true, availableInExperiments: true, liveSampleRate: 0}}
        target="full trace"
        type="human"
      />
    );
    fireEvent.changeText(human.getByTestId("ai-evaluator-instructions"), "Be strict");

    const jsonAssert = renderWithTheme(
      <AiEvaluatorNewView
        assertionConstraint="exists"
        assertionPath="output.text"
        dimensions={[{dataType: "boolean", key: "pass", required: true}]}
        instructions=""
        isCreating={false}
        judgePromptName=""
        name="assert"
        onAddDimension={() => undefined}
        onAssertionConstraintChange={noop}
        onAssertionPathChange={noop}
        onCreate={() => undefined}
        onDimensionChange={() => undefined}
        onInstructionsChange={noop}
        onJudgePromptNameChange={noop}
        onLiveSampleRateChange={() => undefined}
        onNameChange={() => undefined}
        onRemoveDimension={() => undefined}
        onTargetChange={() => undefined}
        onTypeChange={() => undefined}
        runModes={{allowManualRun: true, availableInExperiments: true, liveSampleRate: 0}}
        target="full trace"
        type="json-assert"
      />
    );
    fireEvent.changeText(jsonAssert.getByTestId("ai-evaluator-assertion-path"), "output.score");
    fireEvent.changeText(jsonAssert.getByTestId("ai-evaluator-assertion-constraint"), "gte 0.8");
    expect(jsonAssert.getByTestId("ai-evaluator-assertion-path")).toBeTruthy();
  });
});

describe("AiEvaluatorPanels helpers", () => {
  it("exposes default run modes and initial dimensions", () => {
    const runModes = defaultEvaluatorRunModes();
    assert.equal(runModes.liveSampleRate, 0);
    assert.equal(initialNewEvaluatorDimensions().length, 1);
  });
});
