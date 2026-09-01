import {describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import {AiReviewItemView} from "./AiReviewItemView";
import type {ReviewDetail} from "./reviewTypes";

mock.module("expo-router", () => ({
  router: {push: mock(() => undefined)},
}));

const longInput = Array.from({length: 45}, (_, index) => `word${index}`).join(" ");
const detail: ReviewDetail = {
  dimensions: [{dataType: "boolean", key: "correct", required: true}],
  evaluatorId: "evaluator-1",
  id: "review-1",
  instructions: "Mark correct only when grounded.",
  panels: {
    given: [{key: "note", label: "Clinical note", note: "Check identifiers.", value: longInput}],
    wrote: [{key: "summary", label: "Summary", value: "Short output"}],
  },
  rawInput: {note: longInput},
  rawOutput: {summary: "Short output"},
  status: "pending",
  traceId: "trace-1",
};

describe("AiReviewItemView", () => {
  it("shows pending position, collapsed long fields, reviewer notes, and raw JSON", () => {
    const {getByTestId, getByText, queryByText} = renderWithTheme(
      <AiReviewItemView
        comment=""
        detail={detail}
        isPending
        onAssign={() => undefined}
        onCommentChange={() => undefined}
        onScoreChange={() => undefined}
        onSkip={() => undefined}
        onSubmit={() => undefined}
        position={1}
        scores={{}}
        totalPending={2}
      />
    );
    expect(getByText("Item 1 of 2 pending")).toBeTruthy();
    expect(getByText("45 words")).toBeTruthy();
    expect(queryByText(longInput)).toBeNull();
    expect(getByTestId("ai-review-raw-json")).toBeTruthy();
    expect(queryByText(/"input"/)).toBeNull();
    fireEvent.press(getByTestId("ai-review-field-note.toggle"));
    expect(getByText("Check identifiers.")).toBeTruthy();
  });

  it("wires submit, skip, and assign actions", async () => {
    const onAssign = mock(() => undefined);
    const onSkip = mock(() => undefined);
    const onSubmit = mock(() => undefined);
    const {getByTestId} = renderWithTheme(
      <AiReviewItemView
        comment=""
        detail={detail}
        isPending
        onAssign={onAssign}
        onCommentChange={() => undefined}
        onScoreChange={() => undefined}
        onSkip={onSkip}
        onSubmit={onSubmit}
        position={1}
        scores={{correct: true}}
        totalPending={1}
      />
    );
    await act(async () => {
      fireEvent.press(getByTestId("ai-review-submit-next"));
      fireEvent.press(getByTestId("ai-review-skip"));
      fireEvent.press(getByTestId("ai-review-assign"));
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(onSubmit).toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalled();
    expect(onAssign).toHaveBeenCalled();
  });
});
