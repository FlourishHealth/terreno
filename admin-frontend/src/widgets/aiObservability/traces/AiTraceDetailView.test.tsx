import {describe, expect, it, mock} from "bun:test";
import React from "react";
import {renderWithTheme} from "../../../../../ui/src/test-utils";
import {AiTraceDetailView} from "./AiTraceDetailView";
import type {TraceDetail} from "./traceTypes";

mock.module("expo-router", () => ({
  router: {push: mock(() => {})},
}));

const detail: TraceDetail = {
  flaggedForDataset: false,
  id: "trace-phi",
  name: "clinical-note",
  prompts: [{name: "note", version: 1}],
  scoreCount: 1,
  scores: [{dataType: "boolean", name: "correct", source: "human", value: true}],
  sensitive: true,
  spanCount: 2,
  spans: [
    {
      children: [
        {
          children: [],
          durationMs: 40,
          id: "span-llm",
          input: "patient SSN 123-45-6789",
          kind: "LLM",
          name: "generate",
          output: "draft note",
          sensitive: true,
          startedAt: "2026-09-01T12:00:00.000Z",
          status: "ok",
        },
      ],
      durationMs: 80,
      id: "span-chain",
      input: "patient SSN 123-45-6789",
      kind: "CHAIN",
      name: "pipeline",
      output: "draft note",
      startedAt: "2026-09-01T12:00:00.000Z",
      status: "ok",
    },
  ],
  startedAt: "2026-09-01T12:00:00.000Z",
  status: "ok",
};

describe("AiTraceDetailView", () => {
  it("renders span kinds, indent, scores, and collapsed sensitive I/O", () => {
    const {getByTestId, getByText, queryByText} = renderWithTheme(
      <AiTraceDetailView detail={detail} onBack={() => undefined} />
    );
    expect(getByTestId("ai-trace-span-span-chain-clickable")).toBeTruthy();
    expect(getByTestId("ai-trace-span-span-llm-clickable")).toBeTruthy();
    expect(getByText("CHAIN")).toBeTruthy();
    expect(getByText("LLM")).toBeTruthy();
    expect(getByText("correct")).toBeTruthy();
    expect(getByText("true")).toBeTruthy();
    expect(getByText("human")).toBeTruthy();
    expect(getByTestId("ai-trace-span-input")).toBeTruthy();
    expect(getByText("Input (sensitive)")).toBeTruthy();
    expect(queryByText("patient SSN 123-45-6789")).toBeNull();
  });
});
