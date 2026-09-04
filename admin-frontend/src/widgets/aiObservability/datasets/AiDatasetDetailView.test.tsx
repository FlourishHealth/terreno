import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import {assert} from "chai";
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
  it("shows empty state for human tab when only auto items exist", async () => {
    const {getByTestId, getByText} = renderWithTheme(
      <AiDatasetDetailView
        dataset={dataset}
        items={items.slice(1)}
        onAddItem={async () => undefined}
        onOpenExperiment={() => undefined}
        routeBase="/admin"
      />
    );
    expect(getByTestId("ai-dataset-items-table")).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByText("Human"));
      await Promise.resolve();
    });
    expect(getByTestId("ai-dataset-items-empty")).toBeTruthy();
  });

  it("shows needs review count badge and wires actions", async () => {
    const onOpenExperiment = mock(() => undefined);
    const onOpenTrace = mock(() => undefined);
    const onAddItem = mock(async () => undefined);
    const view = renderWithTheme(
      <AiDatasetDetailView
        dataset={dataset}
        items={items}
        onAddItem={onAddItem}
        onOpenExperiment={onOpenExperiment}
        onOpenTrace={onOpenTrace}
        routeBase="/admin"
      />
    );
    expect(view.getByTestId("ai-dataset-tabs")).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByText("Needs review (2)"));
      await Promise.resolve();
    });
    expect(view.getByTestId("ai-dataset-needs-review-count")).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByTestId("ai-dataset-run-experiment"));
      fireEvent.press(view.getByTestId("ai-dataset-add-item"));
      await Promise.resolve();
    });
    assert.equal(onOpenExperiment.mock.calls.length, 1);
    fireEvent.changeText(view.getByText("Input (JSON)"), '{"q":"new"}');
    fireEvent.changeText(view.getByText("Expected output (JSON)"), '{"a":"ok"}');
    const addButtons = view.getAllByText("Add item");
    await act(async () => {
      fireEvent.press(addButtons[addButtons.length - 1]!);
      await Promise.resolve();
    });
    assert.isAtLeast(onAddItem.mock.calls.length, 1);
    await act(async () => {
      fireEvent.press(view.getByText("Auto"));
      await Promise.resolve();
    });
    await act(async () => {
      fireEvent.press(view.getByText("Open trace"));
      await Promise.resolve();
    });
    assert.equal(onOpenTrace.mock.calls.length, 1);
  });

  it("surfaces add-item errors and dismisses the modal on success", async () => {
    const onAddItem = mock(async () => "Invalid JSON in input.");
    const view = renderWithTheme(
      <AiDatasetDetailView
        dataset={dataset}
        items={items}
        onAddItem={onAddItem}
        onOpenExperiment={() => undefined}
        routeBase="/admin"
      />
    );
    await act(async () => {
      fireEvent.press(view.getByTestId("ai-dataset-add-item"));
      await Promise.resolve();
    });
    const addButtons = view.getAllByText("Add item");
    await act(async () => {
      fireEvent.press(addButtons[addButtons.length - 1]!);
      await Promise.resolve();
    });
    expect(view.getByTestId("ai-dataset-add-item-error")).toBeTruthy();

    onAddItem.mockImplementation(async () => undefined);
    await act(async () => {
      fireEvent.press(view.getByTestId("ai-dataset-add-item"));
      await Promise.resolve();
    });
    const retryButtons = view.getAllByText("Add item");
    await act(async () => {
      fireEvent.press(retryButtons[retryButtons.length - 1]!);
      await Promise.resolve();
    });
    expect(view.queryByTestId("ai-dataset-add-item-error")).toBeNull();
  });
});
