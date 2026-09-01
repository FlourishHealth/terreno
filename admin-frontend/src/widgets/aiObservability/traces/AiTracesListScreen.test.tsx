import {describe, expect, it, mock} from "bun:test";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse} from "../../../types";
import {AiTracesScreenWidget} from "./AiTracesListScreen";
import type {TraceListItem} from "./traceTypes";

mock.module("expo-router", () => ({
  router: {push: mock(() => {})},
  useLocalSearchParams: () => ({}),
}));

interface ListState {
  data?: unknown;
  isError: boolean;
  isLoading: boolean;
}

const listState: ListState = {isError: false, isLoading: false};

const loaded: TraceListItem[] = [
  {
    flaggedForDataset: false,
    id: "trace-ok",
    name: "summarize",
    prompts: [{name: "summarize", version: 1}],
    scoreCount: 0,
    sensitive: false,
    spanCount: 1,
    startedAt: "2026-09-01T12:00:00.000Z",
    status: "ok",
  },
];

const createApi = (): AdminApi => {
  const api = {
    enhanceEndpoints: () => api,
    injectEndpoints: () => ({
      useAiObservabilityEvaluatorsQuery: () => ({
        data: [{id: "eval-1", name: "correctness"}],
        isLoading: false,
      }),
      useAiObservabilityStatusQuery: () => ({
        data: {
          localOn: true,
          plugins: [],
          primaries: {
            datasets: "local",
            experiments: "local",
            prompts: "local",
            reviewQueue: "local",
          },
        },
        isError: false,
        isLoading: false,
      }),
      useAiObservabilityTraceQuery: () => ({
        isError: false,
        isLoading: false,
        refetch: () => undefined,
      }),
      useAiObservabilityTracesQuery: () => ({...listState, refetch: () => undefined}),
      useEnqueueAiObservabilityReviewMutation: () => [
        () => ({unwrap: async () => ({})}),
        {isError: false, isLoading: false},
      ],
    }),
  };
  return api as unknown as AdminApi;
};

const emptyConfig: AdminConfigResponse = {customScreens: [], models: [], scripts: []};

describe("AiTracesScreenWidget", () => {
  it("shows loading then the loaded traces table", () => {
    listState.isLoading = true;
    listState.data = undefined;
    const loading = renderWithTheme(
      <AiTracesScreenWidget
        api={createApi()}
        config={emptyConfig}
        routeBase="/admin"
        screenName="ai-traces"
      />
    );
    expect(loading.getByTestId("ai-traces-loading")).toBeTruthy();
    loading.unmount();

    listState.isLoading = false;
    listState.data = {data: loaded, limit: 20, more: false, page: 1, total: 1};
    const loadedView = renderWithTheme(
      <AiTracesScreenWidget
        api={createApi()}
        config={emptyConfig}
        routeBase="/admin"
        screenName="ai-traces"
      />
    );
    expect(loadedView.getByTestId("ai-traces-table")).toBeTruthy();
  });
});
