import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import {AiPromptEditorView} from "./AiPromptEditorView";
import type {PromptDetail} from "./promptTypes";

mock.module("expo-router", () => ({
  router: {push: mock(() => {})},
}));

const detail: PromptDetail = {
  folder: "examples",
  labels: [
    {label: "latest", version: 1},
    {label: "production", version: 1},
  ],
  name: "summarize",
  tags: [],
  versions: [
    {
      config: {temperature: 0.3},
      sensitive: false,
      system: "You summarize.",
      template: "Summarize {{text}}",
      type: "chat",
      variables: [{key: "text", required: true}],
      version: 1,
    },
  ],
};

const idleHandlers = {
  isRunningPlayground: false,
  isSaving: false,
  isSettingProduction: false,
  onRunPlayground: async () => undefined,
  onSaveVersion: async () => undefined,
  onSelectVersion: () => undefined,
  onSetProduction: async () => undefined,
};

describe("AiPromptEditorView", () => {
  it("saves only as the next immutable version and has no in-place save control", () => {
    const {getByTestId, queryByTestId, queryByText} = renderWithTheme(
      <AiPromptEditorView detail={detail} selectedVersion={1} {...idleHandlers} />
    );
    expect(getByTestId("ai-prompt-save-next")).toBeTruthy();
    expect(queryByTestId("ai-prompt-save-in-place")).toBeNull();
    expect(queryByText("Save")).toBeNull();
  });

  it("names the outgoing production version in the confirm copy", () => {
    const {getByTestId, getByText} = renderWithTheme(
      <AiPromptEditorView detail={detail} selectedVersion={1} {...idleHandlers} />
    );
    expect(getByText(/outgoing production version is v1/)).toBeTruthy();
    expect(getByTestId("ai-prompt-set-production")).toBeTruthy();
  });

  it("keeps Save this run to dataset disabled until phase 2", () => {
    const {getByTestId, getByText} = renderWithTheme(
      <AiPromptEditorView detail={detail} selectedVersion={1} {...idleHandlers} />
    );
    fireEvent.press(getByText("Playground"));
    const dataset = getByTestId("ai-prompt-save-run-dataset");
    expect(dataset.props.accessibilityState?.disabled ?? dataset.props.disabled).toBeTruthy();
  });
});
