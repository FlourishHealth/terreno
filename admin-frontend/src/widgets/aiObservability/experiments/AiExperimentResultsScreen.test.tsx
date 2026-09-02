import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent, waitFor} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse} from "../../../types";
import type {ExperimentRecord} from "./experimentTypes";

let experimentId = "exp-1";

mock.module("expo-router", () => ({
  router: {push: mock(() => {})},
  useLocalSearchParams: () => ({id: experimentId}),
}));

import {AiExperimentResultsScreenWidget} from "./AiExperimentResultsScreen";

const statusData = {
  localOn: true,
  plugins: [],
  primaries: {
    datasets: "local",
    experiments: "local",
    prompts: "local",
    reviewQueue: "local",
  },
};

const baseExperiment: ExperimentRecord = {
  created: "2026-01-01T00:00:00.000Z",
  datasetId: "ds-1",
  evaluatorIds: ["eval-1"],
  id: "exp-1",
  includeUnproofread: false,
  items: [],
  name: "compare",
  promptName: "summarize",
  results: {
    gates: [
      {
        actual: 0.9,
        aggregate: "trueRate",
        dimension: "correct",
        evaluatorName: "quality",
        op: "gte",
        passed: true,
        value: 0.8,
        version: 2,
      },
      {
        actual: 0.5,
        aggregate: "trueRate",
        dimension: "correct",
        evaluatorName: "quality",
        op: "gte",
        passed: false,
        value: 0.8,
        version: 1,
      },
    ],
    lowConfidenceItemIds: [],
    outlierItemIds: [],
    progress: {completed: 1, total: 2},
    totalCostUsd: 0.1,
  },
  status: "running",
  thresholds: [],
  updated: "2026-01-01T00:05:00.000Z",
  versions: [1, 2],
};

let detailData: ExperimentRecord = baseExperiment;

let promoteShouldFail = true;

const promoteImpl = mock(async () => {
  if (promoteShouldFail) {
    throw {data: {status: 409, title: "Gate failed for v2"}};
  }
  return {};
});

const refetch = mock(() => undefined);

const injectedHooks = {
  useAiObservabilityExperimentQuery: () => ({
    data: detailData,
    isError: false,
    isLoading: false,
    refetch,
  }),
  useAiObservabilityStatusQuery: () => ({
    data: statusData,
    isError: false,
    isLoading: false,
  }),
  usePromoteAiObservabilityExperimentMutation: () => [
    () => ({unwrap: promoteImpl}),
    {isError: false, isLoading: false},
  ],
};

const stableApi: AdminApi = {
  enhanceEndpoints: () => stableApi,
  injectEndpoints: () => injectedHooks,
} as unknown as AdminApi;

const emptyConfig: AdminConfigResponse = {customScreens: [], models: [], scripts: []};
const widgetProps = {
  api: stableApi,
  config: emptyConfig,
  routeBase: "/admin",
  screenName: "ai-experiment-results",
};

describe("AiExperimentResultsScreenWidget", () => {
  it("shows loading then running progress", () => {
    const loadingApi = {
      enhanceEndpoints: () => loadingApi,
      injectEndpoints: () => ({
        useAiObservabilityExperimentQuery: () => ({
          data: undefined,
          isError: false,
          isLoading: true,
          refetch: mock(() => undefined),
        }),
        useAiObservabilityStatusQuery: () => ({
          data: statusData,
          isError: false,
          isLoading: false,
        }),
        usePromoteAiObservabilityExperimentMutation: () => [
          () => ({unwrap: promoteImpl}),
          {isError: false, isLoading: false},
        ],
      }),
    } as unknown as AdminApi;
    const loading = renderWithTheme(
      <AiExperimentResultsScreenWidget
        api={loadingApi}
        config={emptyConfig}
        routeBase="/admin"
        screenName="ai-experiment-results"
      />
    );
    expect(loading.getByTestId("ai-experiment-results-loading")).toBeTruthy();
    loading.unmount();

    detailData = baseExperiment;
    const loaded = renderWithTheme(<AiExperimentResultsScreenWidget {...widgetProps} />);
    expect(loaded.getByTestId("ai-experiment-results-running")).toBeTruthy();
  });

  it("does not reset the selected version when polled experiment data updates", async () => {
    detailData = baseExperiment;
    const {getByTestId, rerender} = renderWithTheme(
      <AiExperimentResultsScreenWidget {...widgetProps} />
    );
    await act(async () => {
      fireEvent.press(getByTestId("web_picker"));
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.press(getByTestId("web_dropdown_option_1"));
      await Promise.resolve();
    });
    detailData = {
      ...baseExperiment,
      results: {
        ...baseExperiment.results!,
        progress: {completed: 2, total: 2},
      },
      status: "completed",
    };
    rerender(<AiExperimentResultsScreenWidget {...widgetProps} />);
    expect(getByTestId("ai-experiment-gate-correct")).toHaveTextContent(/v1 quality\.correct/);
  });

  it("blocks promote when gates fail and surfaces API errors", async () => {
    detailData = {
      ...baseExperiment,
      results: {
        ...baseExperiment.results!,
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
        progress: {completed: 2, total: 2},
      },
      status: "completed",
    };
    const view = renderWithTheme(<AiExperimentResultsScreenWidget {...widgetProps} />);
    expect(view.getByTestId("ai-experiment-gates-failing")).toBeTruthy();
    fireEvent.press(view.getByTestId("ai-experiment-promote"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.getByTestId("ai-experiment-promote-blocked")).toBeTruthy();
  });

  it("promotes a passing version", async () => {
    promoteShouldFail = false;
    refetch.mockClear();
    detailData = {
      ...baseExperiment,
      results: {
        ...baseExperiment.results!,
        gates: [
          {
            actual: 0.9,
            aggregate: "trueRate",
            dimension: "correct",
            evaluatorName: "quality",
            op: "gte",
            passed: true,
            value: 0.8,
            version: 2,
          },
        ],
        progress: {completed: 2, total: 2},
      },
      status: "completed",
    };
    const view = renderWithTheme(<AiExperimentResultsScreenWidget {...widgetProps} />);
    await act(async () => {
      fireEvent.press(view.getByTestId("ai-experiment-promote"));
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.press(view.getByText("Promote"));
      await Promise.resolve();
    });
    await waitFor(() => {
      assert.isAtLeast(refetch.mock.calls.length, 1);
    });
  });

  it("shows missing experiment id when route param is absent", () => {
    experimentId = "";
    const missing = renderWithTheme(<AiExperimentResultsScreenWidget {...widgetProps} />);
    expect(missing.getByText("Missing experiment id.")).toBeTruthy();
    missing.unmount();
    experimentId = "exp-1";
  });
});
