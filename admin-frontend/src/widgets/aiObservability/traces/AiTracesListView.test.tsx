import {describe, expect, it, mock} from "bun:test";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import {AiTracesListView} from "./AiTracesListView";
import {emptyTraceFilters, type TraceListItem} from "./traceTypes";

mock.module("expo-router", () => ({
  router: {push: mock(() => {})},
}));

const okTrace: TraceListItem = {
  endedAt: "2026-09-01T12:00:01.000Z",
  flaggedForDataset: false,
  id: "trace-ok",
  name: "summarize",
  prompts: [{name: "summarize", version: 1}],
  scoreCount: 0,
  sensitive: false,
  spanCount: 1,
  startedAt: "2026-09-01T12:00:00.000Z",
  status: "ok",
  usage: {costUsd: 0.0123, inputTokens: 10, outputTokens: 20},
};

const errorTrace: TraceListItem = {
  errorSummary: "model timeout",
  flaggedForDataset: false,
  id: "trace-err",
  name: "failed-call",
  prompts: [
    {name: "summarize", version: 1},
    {name: "safety", version: 2},
  ],
  scoreCount: 0,
  sensitive: false,
  spanCount: 1,
  startedAt: "2026-09-01T12:00:00.000Z",
  status: "error",
};

const sensitiveTrace: TraceListItem = {
  flaggedForDataset: false,
  id: "trace-phi",
  name: "clinical-note",
  prompts: [{name: "note", version: 1}],
  scoreCount: 2,
  sensitive: true,
  spanCount: 3,
  startedAt: "2026-09-01T12:00:00.000Z",
  status: "ok",
};

const idleHandlers = {
  onClearSelection: () => undefined,
  onEnqueueReview: () => undefined,
  onEvaluatorChange: () => undefined,
  onFiltersChange: () => undefined,
  onOpenTrace: () => undefined,
  onPageChange: () => undefined,
  onToggleSelect: () => undefined,
};

describe("AiTracesListView", () => {
  it("renders the empty state", () => {
    const {getByTestId, getByText} = renderWithTheme(
      <AiTracesListView
        evaluatorId=""
        evaluators={[]}
        filters={emptyTraceFilters()}
        page={1}
        selectedIds={[]}
        total={0}
        traces={[]}
        {...idleHandlers}
      />
    );
    expect(getByTestId("ai-traces-empty")).toBeTruthy();
    expect(getByText("No traces match these filters.")).toBeTruthy();
  });

  it("renders an error row with the error line and prompt count", () => {
    const {getByText} = renderWithTheme(
      <AiTracesListView
        evaluatorId=""
        evaluators={[]}
        filters={emptyTraceFilters()}
        page={1}
        selectedIds={[]}
        total={1}
        traces={[errorTrace]}
        {...idleHandlers}
      />
    );
    expect(getByText("model timeout")).toBeTruthy();
    expect(getByText("2 prompts")).toBeTruthy();
    expect(getByText("failed-call")).toBeTruthy();
  });

  it("renders a sensitive badge on sensitive traces", () => {
    const {getByTestId, getByText} = renderWithTheme(
      <AiTracesListView
        evaluatorId=""
        evaluators={[]}
        filters={emptyTraceFilters()}
        page={1}
        selectedIds={[]}
        total={1}
        traces={[sensitiveTrace]}
        {...idleHandlers}
      />
    );
    expect(getByTestId("ai-traces-sensitive-badge")).toBeTruthy();
    expect(getByText("3")).toBeTruthy();
    expect(getByText("2")).toBeTruthy();
  });

  it("shows the bulk bar with a sensitive warning and a disabled dataset action", () => {
    const {getByTestId, getByText} = renderWithTheme(
      <AiTracesListView
        evaluatorId="eval-1"
        evaluators={[{id: "eval-1", name: "correctness"}]}
        filters={emptyTraceFilters()}
        page={1}
        selectedIds={[sensitiveTrace.id, okTrace.id]}
        total={2}
        traces={[sensitiveTrace, okTrace]}
        {...idleHandlers}
      />
    );
    expect(getByTestId("ai-traces-bulk-bar")).toBeTruthy();
    expect(getByText("2 selected")).toBeTruthy();
    expect(getByTestId("ai-traces-sensitive-warning")).toBeTruthy();
    expect(getByText("1 selected trace is marked sensitive.")).toBeTruthy();
    const dataset = getByTestId("ai-traces-add-dataset");
    expect(dataset.props.accessibilityState?.disabled ?? dataset.props.disabled).toBeTruthy();
    expect(getByTestId("ai-traces-send-review")).toBeTruthy();
    expect(getByTestId("ai-traces-clear-selection")).toBeTruthy();
  });
});
