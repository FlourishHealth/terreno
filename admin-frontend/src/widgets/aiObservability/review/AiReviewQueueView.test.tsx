import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import {AiReviewQueueView} from "./AiReviewQueueView";

mock.module("expo-router", () => ({
  router: {push: mock(() => undefined)},
}));

const counts = {done: 0, in_progress: 0, pending: 0, skipped: 0};
const item = {
  enqueuedAt: "2026-09-01T12:00:00.000Z",
  evaluatorId: "evaluator-1",
  id: "review-item-1",
  promptName: "summarize",
  reason: "manual",
  status: "pending" as const,
  traceId: "trace-1",
  traceName: "generate summary",
};

describe("AiReviewQueueView", () => {
  it("names both review intake paths in the empty state", () => {
    const {getByTestId, getByText} = renderWithTheme(
      <AiReviewQueueView
        counts={counts}
        items={[]}
        onOpenItem={() => undefined}
        onRetry={() => undefined}
        onStart={() => undefined}
        onStatusChange={() => undefined}
        status="pending"
      />
    );
    expect(getByTestId("ai-review-empty")).toBeTruthy();
    expect(getByText(/Traces bulk action/)).toBeTruthy();
    expect(getByText(/Assign to me for manual assignment/)).toBeTruthy();
  });

  it("renders oldest-first row fields and starts reviewing", async () => {
    const onStart = mock(() => undefined);
    const {getByTestId, getByText} = renderWithTheme(
      <AiReviewQueueView
        counts={{...counts, pending: 1}}
        items={[item]}
        onOpenItem={() => undefined}
        onRetry={() => undefined}
        onStart={onStart}
        onStatusChange={() => undefined}
        status="pending"
      />
    );
    expect(getByTestId("ai-review-table")).toBeTruthy();
    expect(getByText("generate summary")).toBeTruthy();
    expect(getByText("summarize")).toBeTruthy();
    expect(getByText("Unassigned")).toBeTruthy();
    await act(async () => {
      fireEvent.press(getByTestId("ai-review-start-oldest"));
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(onStart).toHaveBeenCalled();
  });
});
