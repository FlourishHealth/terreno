import {describe, expect, it, mock} from "bun:test";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse} from "../../../types";
import {AiPromptsScreenWidget} from "./AiPromptsListScreen";
import type {PromptListItem} from "./promptTypes";

mock.module("expo-router", () => ({
  router: {push: mock(() => {})},
  useLocalSearchParams: () => ({}),
}));

interface ListState {
  data?: PromptListItem[];
  error?: unknown;
  isError: boolean;
  isLoading: boolean;
}

const listState: ListState = {isError: false, isLoading: false};

const loaded: PromptListItem[] = [
  {
    folder: "examples",
    latestVersion: 1,
    name: "summarize",
    production: "—",
    type: "chat",
  },
];

const createApi = (): AdminApi => {
  const api = {
    enhanceEndpoints: () => api,
    injectEndpoints: () => ({
      useAiObservabilityPromptsQuery: () => ({...listState, refetch: () => undefined}),
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
      useCreateAiObservabilityPromptMutation: () => [
        () => ({unwrap: async () => ({name: "summarize", version: 1})}),
        {isError: false, isLoading: false},
      ],
    }),
  };
  return api as unknown as AdminApi;
};

const emptyConfig: AdminConfigResponse = {customScreens: [], models: [], scripts: []};

describe("AiPromptsScreenWidget", () => {
  it("shows loading then the loaded library", () => {
    listState.isLoading = true;
    listState.data = undefined;
    const loading = renderWithTheme(
      <AiPromptsScreenWidget
        api={createApi()}
        config={emptyConfig}
        routeBase="/admin"
        screenName="ai-prompts"
      />
    );
    expect(loading.getByTestId("ai-prompts-loading")).toBeTruthy();
    loading.unmount();

    listState.isLoading = false;
    listState.data = loaded;
    const loadedView = renderWithTheme(
      <AiPromptsScreenWidget
        api={createApi()}
        config={emptyConfig}
        routeBase="/admin"
        screenName="ai-prompts"
      />
    );
    expect(loadedView.getByTestId("ai-prompts-table")).toBeTruthy();
  });
});
