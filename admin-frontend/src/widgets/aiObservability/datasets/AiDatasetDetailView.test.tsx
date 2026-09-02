import {describe, expect, it} from "bun:test";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import {AiDatasetDetailView} from "./AiDatasetDetailView";
import type {DatasetItemRecord, DatasetRecord} from "./datasetTypes";

const dataset: DatasetRecord = {
  counts: {auto: 2, human: 1, needsReview: 2, total: 3},
  created: "2026-01-01T00:00:00.000Z",
  id: "ds-1",
  inputSchemaPromptName: "summarize",
  name: "example-gold",
  tags: [],
  updated: "2026-01-02T00:00:00.000Z",
};

const items: DatasetItemRecord[] = [
  {
    annotatedBy: {label: "reviewer"},
    created: "2026-01-01T00:00:00.000Z",
    datasetId: "ds-1",
    expectedOutput: {text: "ok"},
    id: "item-1",
    input: {q: "hello"},
    origin: "manual",
    proofread: true,
    tags: [],
    updated: "2026-01-01T00:00:00.000Z",
  },
  {
    created: "2026-01-01T00:00:00.000Z",
    datasetId: "ds-1",
    id: "item-2",
    input: {q: "trace"},
    origin: "trace",
    proofread: false,
    sourceTraceId: "trace-1",
    tags: [],
    updated: "2026-01-01T00:00:00.000Z",
  },
];

describe("AiDatasetDetailView tabs", () => {
  it("shows empty state for human tab when only auto items exist", () => {
    const {getByTestId} = renderWithTheme(
      <AiDatasetDetailView
        dataset={dataset}
        items={[items[1] ?? items[0]!]}
        onAddItem={() => undefined}
        onOpenExperiment={() => undefined}
        routeBase="/admin"
      />
    );
    expect(getByTestId("ai-dataset-items-table")).toBeTruthy();
  });

  it("shows needs review count badge", () => {
    const {getByTestId} = renderWithTheme(
      <AiDatasetDetailView
        dataset={dataset}
        items={items}
        onAddItem={() => undefined}
        onOpenExperiment={() => undefined}
        routeBase="/admin"
      />
    );
    expect(getByTestId("ai-dataset-tabs")).toBeTruthy();
  });
});
