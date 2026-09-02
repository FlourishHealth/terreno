import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import type {AdminApi, AdminConfigResponse} from "../../../types";

const routerPush = mock(() => {});

mock.module("expo-router", () => ({
  router: {push: routerPush},
  useLocalSearchParams: () => ({}),
}));

import {AiEvaluatorNewScreenWidget} from "./AiEvaluatorNewScreen";

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

let createShouldFail = false;

const createMutation = mock(() => ({
  unwrap: async () => {
    if (createShouldFail) {
      throw {data: {title: "Duplicate name"}};
    }
    return {id: "eval-new", name: "quality"};
  },
}));

const injectedHooks = {
  useAiObservabilityPromptQuery: () => ({
    data: {
      folder: "ops",
      labels: [{label: "production", version: 1}],
      name: "judge",
      tags: [],
      versions: [
        {
          outputSchema: {properties: {quality: {type: "number"}}},
          sensitive: false,
          template: "Judge",
          type: "text",
          variables: [],
          version: 1,
        },
      ],
    },
    isError: false,
    isLoading: false,
  }),
  useAiObservabilityStatusQuery: () => ({
    data: statusData,
    isError: false,
    isLoading: false,
  }),
  useCreateAiObservabilityEvaluatorMutation: () => [
    createMutation,
    {isError: false, isLoading: false},
  ],
};

const stableApi: AdminApi = {
  enhanceEndpoints: () => stableApi,
  injectEndpoints: () => injectedHooks,
} as unknown as AdminApi;

const emptyConfig: AdminConfigResponse = {customScreens: [], models: [], scripts: []};

const setDimensionKey = (view: ReturnType<typeof renderWithTheme>, key: string): void => {
  const emptyInputs = view.queryAllByDisplayValue("");
  if (emptyInputs.length > 0) {
    fireEvent.changeText(emptyInputs[0], key);
    return;
  }
  fireEvent.changeText(view.getByDisplayValue("wrong-key"), key);
};

describe("AiEvaluatorNewScreenWidget", () => {
  it("validates name, schema mismatch, and navigates on success", async () => {
    createShouldFail = false;
    routerPush.mockClear();
    const view = renderWithTheme(
      <AiEvaluatorNewScreenWidget
        api={stableApi}
        config={emptyConfig}
        routeBase="/admin"
        screenName="ai-evaluator-new"
      />
    );
    await act(async () => {
      fireEvent.press(view.getByTestId("ai-evaluator-submit"));
      await Promise.resolve();
    });
    expect(view.getByTestId("ai-evaluator-create-error")).toBeTruthy();

    fireEvent.changeText(view.getByTestId("ai-evaluator-name"), "quality");
    setDimensionKey(view, "wrong-key");
    await act(async () => {
      fireEvent.press(view.getByTestId("ai-evaluator-type-llm-judge"));
      await Promise.resolve();
    });
    fireEvent.changeText(view.getByTestId("ai-evaluator-judge-prompt"), "judge");
    await act(async () => {
      fireEvent.press(view.getByTestId("ai-evaluator-submit"));
      await Promise.resolve();
    });
    expect(view.getByTestId("ai-evaluator-schema-mismatch")).toBeTruthy();

    await act(async () => {
      fireEvent.press(view.getByTestId("ai-evaluator-type-human"));
      await Promise.resolve();
    });
    setDimensionKey(view, "correct");
    await act(async () => {
      fireEvent.press(view.getByTestId("ai-evaluator-submit"));
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    assert.equal(routerPush.mock.calls.length, 1);
  });

  it("surfaces create API errors", async () => {
    createShouldFail = true;
    const view = renderWithTheme(
      <AiEvaluatorNewScreenWidget
        api={stableApi}
        config={emptyConfig}
        routeBase="/admin"
        screenName="ai-evaluator-new"
      />
    );
    fireEvent.changeText(view.getByTestId("ai-evaluator-name"), "quality");
    setDimensionKey(view, "correct");
    await act(async () => {
      fireEvent.press(view.getByTestId("ai-evaluator-submit"));
      await Promise.resolve();
    });
    expect(view.getByTestId("ai-evaluator-create-error")).toBeTruthy();
    assert.include(
      String(view.getByTestId("ai-evaluator-create-error").props.children),
      "Duplicate name"
    );
  });

  it("validates empty dimension keys and creates json-assert evaluators", async () => {
    createShouldFail = false;
    routerPush.mockClear();
    const view = renderWithTheme(
      <AiEvaluatorNewScreenWidget
        api={stableApi}
        config={emptyConfig}
        routeBase="/admin"
        screenName="ai-evaluator-new"
      />
    );
    fireEvent.changeText(view.getByTestId("ai-evaluator-name"), "assert");
    await act(async () => {
      fireEvent.press(view.getByTestId("ai-evaluator-type-json-assert"));
      await Promise.resolve();
    });
    fireEvent.changeText(view.getByTestId("ai-evaluator-assertion-path"), "output.text");
    await act(async () => {
      fireEvent.press(view.getByTestId("ai-evaluator-submit"));
      await Promise.resolve();
    });
    expect(view.getByText("Each dimension needs a key.")).toBeTruthy();

    setDimensionKey(view, "pass");
    await act(async () => {
      fireEvent.press(view.getByTestId("ai-evaluator-submit"));
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    assert.equal(routerPush.mock.calls.length, 1);
  });

  it("edits dimensions, live sample rate, and creates human evaluators", async () => {
    createShouldFail = false;
    routerPush.mockClear();
    const view = renderWithTheme(
      <AiEvaluatorNewScreenWidget
        api={stableApi}
        config={emptyConfig}
        routeBase="/admin"
        screenName="ai-evaluator-new"
      />
    );
    fireEvent.changeText(view.getByTestId("ai-evaluator-name"), "human-review");
    setDimensionKey(view, "pass");
    await act(async () => {
      fireEvent.press(view.getByTestId("ai-evaluator-type-human"));
      await Promise.resolve();
    });
    fireEvent.changeText(view.getByTestId("ai-evaluator-instructions"), "Rate quality");
    fireEvent.changeText(view.getByTestId("ai-evaluator-live-sample"), "15");
    await act(async () => {
      fireEvent.press(view.getByTestId("ai-evaluator-add-dimension"));
      await Promise.resolve();
    });
    const removeButtons = view.getAllByText("Remove");
    await act(async () => {
      fireEvent.press(removeButtons[removeButtons.length - 1]!);
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.press(view.getByTestId("ai-evaluator-submit"));
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    assert.equal(routerPush.mock.calls.length, 1);
  });
});
