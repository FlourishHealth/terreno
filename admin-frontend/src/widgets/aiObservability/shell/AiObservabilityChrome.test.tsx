import {describe, expect, it, mock} from "bun:test";
import {Text} from "@terreno/ui";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse} from "../../../types";
import {AiObservabilityChrome} from "./AiObservabilityChrome";
import {AI_OBSERVABILITY_WIDGETS} from "./AiObservabilityScreenWidgets";
import {AiObservabilityStatusChip} from "./AiObservabilityStatusChip";
import {
  buildAiObservabilityBreadcrumbs,
  formatObservabilityStatusChip,
  getAiObservabilityNavItems,
  type ObservabilityStatusPayload,
  unwrapObservabilityStatus,
} from "./aiObservabilityNav";

mock.module("expo-router", () => ({
  router: {push: mock(() => {})},
}));

const localOnStatus: ObservabilityStatusPayload = {
  localOn: true,
  plugins: [{capabilities: ["prompts", "reviewQueue", "traces"], id: "local"}],
  primaries: {
    datasets: "local",
    experiments: "local",
    prompts: "local",
    reviewQueue: "local",
  },
};

const localOffStatus: ObservabilityStatusPayload = {
  localOn: false,
  plugins: [{capabilities: ["prompts", "traces"], id: "langfuse"}],
  primaries: {
    datasets: "langfuse",
    experiments: "langfuse",
    prompts: "langfuse",
    reviewQueue: "local",
  },
};

const emptyConfig: AdminConfigResponse = {customScreens: [], models: [], scripts: []};
const stubApi = {} as unknown as AdminApi;

describe("AI observability chrome", () => {
  it("formats the status chip for local on and local off primaries", () => {
    expect(formatObservabilityStatusChip(localOnStatus)).toBe(
      "Local on · prompts:local · datasets:local · experiments:local"
    );
    expect(formatObservabilityStatusChip(localOffStatus)).toBe(
      "Local off · prompts:langfuse · datasets:langfuse · experiments:langfuse"
    );
  });

  it("unwraps both envelope and already-unwrapped status payloads", () => {
    expect(unwrapObservabilityStatus({data: localOnStatus})).toEqual(localOnStatus);
    expect(unwrapObservabilityStatus(localOnStatus)).toEqual(localOnStatus);
  });

  it("hides the review queue nav entry when the local plugin is off", () => {
    expect(getAiObservabilityNavItems(true).map((item) => item.name)).toEqual([
      "ai-prompts",
      "ai-traces",
      "ai-evaluators",
      "ai-datasets",
      "ai-experiments",
      "ai-review",
    ]);
    expect(getAiObservabilityNavItems(false).map((item) => item.name)).toEqual([
      "ai-prompts",
      "ai-traces",
      "ai-evaluators",
      "ai-datasets",
      "ai-experiments",
    ]);
  });

  it("builds Admin / AI Observability / Section / leaf breadcrumbs", () => {
    const crumbs = buildAiObservabilityBreadcrumbs({
      routeBase: "/admin",
      screenName: "ai-review-item",
    });
    expect(crumbs.map((crumb) => crumb.label)).toEqual([
      "Admin",
      "AI Observability",
      "Review",
      "Item",
    ]);
  });

  it("renders loading, error, local-on, and local-off chip states", () => {
    const loading = renderWithTheme(<AiObservabilityStatusChip isLoading />);
    expect(loading.getByText("Checking observability…")).toBeTruthy();

    const errored = renderWithTheme(<AiObservabilityStatusChip error />);
    expect(errored.getByText("Observability unavailable")).toBeTruthy();

    const on = renderWithTheme(<AiObservabilityStatusChip status={localOnStatus} />);
    expect(
      on.getByText("Local on · prompts:local · datasets:local · experiments:local")
    ).toBeTruthy();

    const off = renderWithTheme(<AiObservabilityStatusChip status={localOffStatus} />);
    expect(
      off.getByText("Local off · prompts:langfuse · datasets:langfuse · experiments:langfuse")
    ).toBeTruthy();
  });

  it("hides review queue content when the local plugin is off", () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <AiObservabilityChrome
        api={stubApi}
        config={emptyConfig}
        routeBase="/admin"
        screenName="ai-review"
        status={localOffStatus}
      />
    );
    expect(getByTestId("ai-observability-review-hidden")).toBeTruthy();
    expect(queryByTestId("ai-observability-placeholder-ai-review")).toBeNull();
  });

  it("hides review item content when the local plugin is off", () => {
    const {getByTestId, queryByText} = renderWithTheme(
      <AiObservabilityChrome
        api={stubApi}
        config={emptyConfig}
        routeBase="/admin"
        screenName="ai-review-item"
        status={localOffStatus}
      >
        <Text>Private review body</Text>
      </AiObservabilityChrome>
    );
    expect(getByTestId("ai-observability-review-hidden")).toBeTruthy();
    expect(queryByText("Private review body")).toBeNull();
  });

  it("registers phase 2 screen widgets including evaluators, datasets, and experiments", () => {
    expect(Object.keys(AI_OBSERVABILITY_WIDGETS).sort()).toEqual([
      "ai-dataset-detail",
      "ai-datasets",
      "ai-evaluator-detail",
      "ai-evaluator-new",
      "ai-evaluators",
      "ai-experiment-new",
      "ai-experiment-results",
      "ai-experiments",
      "ai-prompt-editor",
      "ai-prompts",
      "ai-review",
      "ai-review-item",
      "ai-trace-detail",
      "ai-traces",
    ]);
  });
});
