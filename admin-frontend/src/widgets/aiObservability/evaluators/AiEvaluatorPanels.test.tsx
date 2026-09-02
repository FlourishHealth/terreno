import {describe, expect, it} from "bun:test";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import {AiEvaluatorNewView} from "./AiEvaluatorPanels";
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
});
