import {describe, expect, it} from "bun:test";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import {AiExperimentResultsView} from "./AiExperimentResultsView";
import type {ExperimentRecord} from "./experimentTypes";

const baseExperiment: ExperimentRecord = {
  created: "2026-01-01T00:00:00.000Z",
  datasetId: "ds-1",
  evaluatorIds: ["eval-1"],
  id: "exp-1",
  includeUnproofread: false,
  items: [
    {
      datasetItemId: "item-1",
      failed: true,
      id: "row-1",
      versionResults: {
        "1": {evaluatorScores: {}, output: "a"},
        "2": {evaluatorScores: {}, output: "b"},
      },
    },
  ],
  name: "compare summarize",
  promptName: "summarize",
  results: {
    gates: [
      {
        actual: 0.4,
        aggregate: "trueRate",
        dimension: "correct",
        evaluatorName: "quality",
        op: "gte",
        passed: false,
        value: 0.8,
        version: 2,
      },
    ],
    lowConfidenceItemIds: [],
    outlierItemIds: ["item-1"],
    progress: {completed: 1, total: 1},
    totalCostUsd: 0.12,
  },
  status: "completed",
  thresholds: [],
  updated: "2026-01-01T00:05:00.000Z",
  versions: [1, 2],
};

describe("AiExperimentResultsView", () => {
  it("shows running progress text while pending", () => {
    const {getByTestId} = renderWithTheme(
      <AiExperimentResultsView
        experiment={{
          ...baseExperiment,
          results: {...baseExperiment.results!, progress: {completed: 0, total: 3}},
          status: "running",
        }}
        isPromoting={false}
        onDismissPromoteConfirm={() => undefined}
        onOpenPromoteConfirm={() => undefined}
        onPromote={() => undefined}
        onSelectVersion={() => undefined}
        promoteConfirmOpen={false}
        promoteVersion={2}
        selectedVersion={2}
      />
    );
    expect(getByTestId("ai-experiment-results-running")).toBeTruthy();
  });

  it("shows gate-fail badge and blocked promote copy", () => {
    const {getByTestId} = renderWithTheme(
      <AiExperimentResultsView
        experiment={baseExperiment}
        isPromoting={false}
        onDismissPromoteConfirm={() => undefined}
        onOpenPromoteConfirm={() => undefined}
        onPromote={() => undefined}
        onSelectVersion={() => undefined}
        promoteBlockedMessage="gate failed for v2 quality.correct"
        promoteConfirmOpen={false}
        promoteVersion={2}
        selectedVersion={2}
      />
    );
    expect(getByTestId("ai-experiment-gates-failing")).toBeTruthy();
    assert.include(
      String(getByTestId("ai-experiment-promote-blocked").props.children),
      "quality.correct"
    );
  });
});
