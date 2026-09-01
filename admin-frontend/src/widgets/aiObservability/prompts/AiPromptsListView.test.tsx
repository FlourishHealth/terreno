import {describe, expect, it, mock} from "bun:test";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import {AiPromptsListView} from "./AiPromptsListView";
import type {PromptListItem} from "./promptTypes";

mock.module("expo-router", () => ({
  router: {push: mock(() => {})},
}));

const prompts: PromptListItem[] = [
  {
    folder: "examples",
    latestVersion: 2,
    name: "summarize",
    production: 1,
    type: "chat",
    usage7d: {calls: 3, costUsd: 0.2},
  },
];

const idleHandlers = {
  onCreate: () => undefined,
  onCreateFolderChange: () => undefined,
  onCreateNameChange: () => undefined,
  onCreateSystemChange: () => undefined,
  onCreateTemplateChange: () => undefined,
  onDismissCreate: () => undefined,
  onFolderChange: () => undefined,
  onOpenCreate: () => undefined,
  onOpenPrompt: () => undefined,
  onSearchChange: () => undefined,
};

describe("AiPromptsListView", () => {
  it("renders the loading state", () => {
    const {getByTestId} = renderWithTheme(
      <AiPromptsListView
        createFolder="examples"
        createName=""
        createOpen={false}
        createSystem=""
        createTemplate=""
        folder=""
        isLoading
        prompts={[]}
        search=""
        {...idleHandlers}
      />
    );
    expect(getByTestId("ai-prompts-loading")).toBeTruthy();
  });

  it("renders the empty state", () => {
    const {getByTestId, getByText} = renderWithTheme(
      <AiPromptsListView
        createFolder="examples"
        createName=""
        createOpen={false}
        createSystem=""
        createTemplate=""
        folder=""
        prompts={[]}
        search=""
        {...idleHandlers}
      />
    );
    expect(getByTestId("ai-prompts-empty")).toBeTruthy();
    expect(getByText("No prompts in this folder yet.")).toBeTruthy();
  });

  it("renders a loaded table with folder counts and latest vs production columns", () => {
    const {getByTestId, getByText} = renderWithTheme(
      <AiPromptsListView
        createFolder="examples"
        createName=""
        createOpen={false}
        createSystem=""
        createTemplate=""
        folder=""
        prompts={prompts}
        search=""
        {...idleHandlers}
      />
    );
    expect(getByTestId("ai-prompts-table")).toBeTruthy();
    expect(getByText("All (1)")).toBeTruthy();
    expect(getByText("examples (1)")).toBeTruthy();
    expect(getByText("examples/summarize")).toBeTruthy();
    expect(getByText("v2")).toBeTruthy();
    expect(getByText("v1")).toBeTruthy();
  });

  it("renders an Open control for each prompt", () => {
    const {getByTestId} = renderWithTheme(
      <AiPromptsListView
        createFolder="examples"
        createName=""
        createOpen={false}
        createSystem=""
        createTemplate=""
        folder=""
        prompts={prompts}
        search=""
        {...idleHandlers}
      />
    );
    expect(getByTestId("ai-prompt-open-summarize")).toBeTruthy();
  });
});
