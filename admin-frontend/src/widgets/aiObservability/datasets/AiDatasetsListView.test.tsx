import {describe, expect, it, mock} from "bun:test";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import {AiDatasetsListView} from "./AiDatasetsListView";
import type {DatasetRecord} from "./datasetTypes";

mock.module("expo-router", () => ({
  router: {push: mock(() => {})},
}));

const datasets: DatasetRecord[] = [
  {
    counts: {auto: 2, human: 1, needsReview: 1, total: 3},
    created: "2026-01-01T00:00:00.000Z",
    id: "ds-1",
    inputSchemaPromptName: "summarize",
    name: "gold",
    tags: [],
    updated: "2026-01-02T00:00:00.000Z",
  },
];

const idleHandlers = {
  onCreate: () => undefined,
  onCreateNameChange: () => undefined,
  onCreatePromptBindingChange: () => undefined,
  onDismissCreate: () => undefined,
  onDismissImport: () => undefined,
  onFilePicked: () => undefined,
  onImportPasteChange: () => undefined,
  onImportSubmit: () => undefined,
  onOpenCreate: () => undefined,
  onOpenDetail: () => undefined,
  onOpenImport: () => undefined,
  onRetry: () => undefined,
};

describe("AiDatasetsListView", () => {
  it("renders the empty state", () => {
    const {getByTestId} = renderWithTheme(
      <AiDatasetsListView
        createName=""
        createOpen={false}
        createPromptBinding=""
        datasets={[]}
        importOpen={false}
        importPaste=""
        isCreating={false}
        isImporting={false}
        isLoading={false}
        {...idleHandlers}
      />
    );
    expect(getByTestId("ai-datasets-empty")).toBeTruthy();
  });

  it("renders a loaded table with open and import controls", () => {
    const {getByTestId} = renderWithTheme(
      <AiDatasetsListView
        createName=""
        createOpen={false}
        createPromptBinding=""
        datasets={datasets}
        importOpen={false}
        importPaste=""
        isCreating={false}
        isImporting={false}
        isLoading={false}
        {...idleHandlers}
      />
    );
    expect(getByTestId("ai-datasets-table")).toBeTruthy();
    expect(getByTestId("ai-datasets-open-ds-1")).toBeTruthy();
    expect(getByTestId("ai-datasets-import-ds-1")).toBeTruthy();
  });
});
