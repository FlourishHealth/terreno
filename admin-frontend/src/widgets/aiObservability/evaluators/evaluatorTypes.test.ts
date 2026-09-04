import {describe, it} from "bun:test";
import {assert} from "chai";
import type {EvaluatorRecord} from "./evaluatorTypes";
import {
  emptyDimension,
  formatDimensionSummary,
  formatRunModeChips,
  judgeSchemaMissingDimensions,
  parseApiErrorTitle,
  unwrapEvaluatorList,
  unwrapEvaluatorRecord,
  unwrapObservabilityPayload,
} from "./evaluatorTypes";

const evaluator: EvaluatorRecord = {
  confidenceAlertBelow: 0.5,
  dimensions: [{dataType: "boolean", key: "correct", required: true}],
  id: "eval-1",
  name: "quality",
  runModes: {allowManualRun: true, availableInExperiments: true, liveSampleRate: 10},
  target: "full trace",
  type: "human",
};

describe("evaluatorTypes helpers", () => {
  it("unwraps observability payloads", () => {
    assert.deepEqual(unwrapObservabilityPayload({data: evaluator}), evaluator);
    assert.isUndefined(unwrapObservabilityPayload(undefined));
  });

  it("unwraps evaluator lists and records", () => {
    assert.deepEqual(unwrapEvaluatorList([evaluator]), [evaluator]);
    assert.deepEqual(unwrapEvaluatorList({data: [evaluator]}), [evaluator]);
    assert.deepEqual(unwrapEvaluatorList([{id: "x"}]), []);
    assert.deepEqual(unwrapEvaluatorRecord(evaluator)?.id, "eval-1");
    assert.isUndefined(unwrapEvaluatorRecord({id: 1}));
  });

  it("formats dimension summaries and run mode chips", () => {
    assert.equal(formatDimensionSummary([]), "—");
    assert.equal(formatDimensionSummary(evaluator.dimensions), "correct");
    assert.deepEqual(formatRunModeChips(evaluator.runModes), ["Manual", "Experiments", "Live 10%"]);
    assert.deepEqual(
      formatRunModeChips({allowManualRun: false, availableInExperiments: false, liveSampleRate: 0}),
      []
    );
  });

  it("detects judge schema dimension mismatches", () => {
    const missing = judgeSchemaMissingDimensions(
      [
        {dataType: "boolean", key: "correct", required: true},
        {dataType: "numeric", key: "optional", required: false},
      ],
      {properties: {quality: {type: "number"}}}
    );
    assert.deepEqual(missing, ["correct"]);
  });

  it("parses API error titles from RTK shapes", () => {
    assert.equal(parseApiErrorTitle({data: {title: "Conflict"}}), "Conflict");
    assert.equal(parseApiErrorTitle({message: "Network down"}), "Network down");
    assert.isUndefined(parseApiErrorTitle("plain"));
  });

  it("creates an empty dimension template", () => {
    assert.deepEqual(emptyDimension(), {dataType: "boolean", key: "", required: true});
  });
});
