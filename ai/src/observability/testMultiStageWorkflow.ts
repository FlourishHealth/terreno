import {randomUUID} from "node:crypto";
import {DateTime} from "luxon";
import type mongoose from "mongoose";

import {TemperaturePresets} from "../service/aiService";
import {
  OBS_TEST_MULTI_STAGE_CALL_1_SYSTEM,
  OBS_TEST_MULTI_STAGE_CALL_2_SYSTEM,
  OBS_TEST_MULTI_STAGE_FINAL_SYSTEM,
} from "../service/prompts";
import type {ObservabilityGenerateClient, SpanRecord, TraceRecord} from "./types";

export interface TestMultiStageStageSummary {
  name: string;
  output?: unknown;
  status: "error" | "ok";
}

export interface TestMultiStageWorkflowResult {
  output: string;
  stages: TestMultiStageStageSummary[];
  traceId?: string;
}

export interface TestMultiStageWorkflowParams {
  aiService: ObservabilityGenerateClient;
  exportTrace: (trace: TraceRecord) => Promise<string | undefined>;
  input: string;
  userId?: mongoose.Types.ObjectId;
}

const toIsoUtc = (millis: number): string => {
  return DateTime.fromMillis(millis, {zone: "utc"}).toISO() ?? "";
};

const computeTextMetrics = (text: string): {charCount: number; wordCount: number} => {
  return {
    charCount: text.length,
    wordCount: text.split(/\s+/).filter((word) => word.length > 0).length,
  };
};

const buildChildSpan = (params: {
  endedAt: number;
  error?: string;
  input: unknown;
  kind: SpanRecord["kind"];
  name: string;
  output?: unknown;
  startedAt: number;
  status: "error" | "ok";
  traceStart: number;
}): SpanRecord => {
  return {
    durationMs: params.endedAt - params.startedAt,
    endedAt: toIsoUtc(params.endedAt),
    id: randomUUID(),
    input: params.input,
    kind: params.kind,
    name: params.name,
    output: params.output,
    startedAt: toIsoUtc(params.startedAt),
    startOffsetMs: params.startedAt - params.traceStart,
    status: params.status,
    ...(params.error ? {error: params.error} : {}),
  };
};

const buildTrace = (params: {
  childSpans: SpanRecord[];
  errorSummary?: string;
  input: string;
  output?: string;
  status: "error" | "ok";
  traceStart: number;
  userId?: mongoose.Types.ObjectId;
}): TraceRecord => {
  const endedAt = DateTime.now().toMillis();
  const rootId = randomUUID();
  const rootSpan: SpanRecord = {
    durationMs: endedAt - params.traceStart,
    endedAt: toIsoUtc(endedAt),
    id: rootId,
    input: params.input,
    kind: "CHAIN",
    name: "test-multi-stage",
    output: params.output,
    startedAt: toIsoUtc(params.traceStart),
    status: params.status,
    ...(params.errorSummary ? {error: params.errorSummary} : {}),
  };
  return {
    endedAt: toIsoUtc(endedAt),
    id: randomUUID(),
    input: params.input,
    name: "test-multi-stage",
    output: params.output,
    prompts: [],
    sensitive: false,
    spans: [
      rootSpan,
      ...params.childSpans.map((child) => {
        return {
          ...child,
          parentSpanId: rootId,
        };
      }),
    ],
    startedAt: toIsoUtc(params.traceStart),
    status: params.status,
    userId: params.userId?.toString(),
    ...(params.errorSummary ? {errorSummary: params.errorSummary} : {}),
  };
};

export const runTestMultiStageWorkflow = async (
  params: TestMultiStageWorkflowParams
): Promise<TestMultiStageWorkflowResult> => {
  const traceStart = DateTime.now().toMillis();
  const childSpans: SpanRecord[] = [];
  const stages: TestMultiStageStageSummary[] = [];

  const runLlmStage = async (name: string, systemPrompt: string): Promise<string> => {
    const startedAt = DateTime.now().toMillis();
    try {
      const output = await params.aiService.generateText({
        prompt: params.input,
        skipTrace: true,
        systemPrompt,
        temperature: TemperaturePresets.DETERMINISTIC,
        userId: params.userId,
      });
      const endedAt = DateTime.now().toMillis();
      childSpans.push(
        buildChildSpan({
          endedAt,
          input: params.input,
          kind: "LLM",
          name,
          output,
          startedAt,
          status: "ok",
          traceStart,
        })
      );
      stages.push({name, output, status: "ok"});
      return output;
    } catch (error) {
      const endedAt = DateTime.now().toMillis();
      const message = error instanceof Error ? error.message : String(error);
      childSpans.push(
        buildChildSpan({
          endedAt,
          error: message,
          input: params.input,
          kind: "LLM",
          name,
          output: undefined,
          startedAt,
          status: "error",
          traceStart,
        })
      );
      stages.push({name, status: "error"});
      const trace = buildTrace({
        childSpans,
        errorSummary: message,
        input: params.input,
        status: "error",
        traceStart,
        userId: params.userId,
      });
      await params.exportTrace(trace);
      throw error;
    }
  };

  const call1Output = await runLlmStage("call-1", OBS_TEST_MULTI_STAGE_CALL_1_SYSTEM);
  const call2Output = await runLlmStage("call-2", OBS_TEST_MULTI_STAGE_CALL_2_SYSTEM);

  const toolStartedAt = DateTime.now().toMillis();
  const toolOutput = {
    call1: computeTextMetrics(call1Output),
    call2: computeTextMetrics(call2Output),
    combinedCharCount: call1Output.length + call2Output.length,
  };
  const toolEndedAt = DateTime.now().toMillis();
  childSpans.push(
    buildChildSpan({
      endedAt: toolEndedAt,
      input: {call1: call1Output, call2: call2Output},
      kind: "TOOL",
      name: "text-metrics",
      output: toolOutput,
      startedAt: toolStartedAt,
      status: "ok",
      traceStart,
    })
  );
  stages.push({name: "text-metrics", output: toolOutput, status: "ok"});

  const finalPrompt =
    `Stage one phrase: ${call1Output}\n` +
    `Stage two keywords: ${call2Output}\n` +
    `Text metrics: ${JSON.stringify(toolOutput)}`;
  const finalStartedAt = DateTime.now().toMillis();
  let finalOutput = "";
  try {
    finalOutput = await params.aiService.generateText({
      prompt: finalPrompt,
      skipTrace: true,
      systemPrompt: OBS_TEST_MULTI_STAGE_FINAL_SYSTEM,
      temperature: TemperaturePresets.DETERMINISTIC,
      userId: params.userId,
    });
    const finalEndedAt = DateTime.now().toMillis();
    childSpans.push(
      buildChildSpan({
        endedAt: finalEndedAt,
        input: finalPrompt,
        kind: "LLM",
        name: "final",
        output: finalOutput,
        startedAt: finalStartedAt,
        status: "ok",
        traceStart,
      })
    );
    stages.push({name: "final", output: finalOutput, status: "ok"});
  } catch (error) {
    const finalEndedAt = DateTime.now().toMillis();
    const message = error instanceof Error ? error.message : String(error);
    childSpans.push(
      buildChildSpan({
        endedAt: finalEndedAt,
        error: message,
        input: finalPrompt,
        kind: "LLM",
        name: "final",
        output: undefined,
        startedAt: finalStartedAt,
        status: "error",
        traceStart,
      })
    );
    stages.push({name: "final", status: "error"});
    const trace = buildTrace({
      childSpans,
      errorSummary: message,
      input: params.input,
      status: "error",
      traceStart,
      userId: params.userId,
    });
    await params.exportTrace(trace);
    throw error;
  }

  const trace = buildTrace({
    childSpans,
    input: params.input,
    output: finalOutput,
    status: "ok",
    traceStart,
    userId: params.userId,
  });
  const traceId = await params.exportTrace(trace);

  return {
    output: finalOutput,
    stages,
    traceId,
  };
};
