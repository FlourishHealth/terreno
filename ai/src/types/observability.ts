import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "@terreno/api";
import type mongoose from "mongoose";

export interface ObsPromptVariable {
  key: string;
  label?: string;
  required: boolean;
  reviewerNote?: string;
}

export interface ObsPromptUsage {
  costUsd?: number;
  inputTokens?: number;
  model?: string;
  outputTokens?: number;
}

export interface ObsPromptRef {
  label?: string;
  name: string;
  version: number;
}

export interface ObsPromptDocument extends mongoose.Document<mongoose.Types.ObjectId> {
  created: Date;
  deleted: boolean;
  folder: string;
  name: string;
  tags: string[];
  updated: Date;
}

export interface ObsPromptStatics
  extends FindExactlyOnePlugin<ObsPromptDocument>,
    FindOneOrNonePlugin<ObsPromptDocument> {}

export interface ObsPromptModel extends mongoose.Model<ObsPromptDocument>, ObsPromptStatics {}

export interface ObsPromptVersionDocument extends mongoose.Document<mongoose.Types.ObjectId> {
  config?: Record<string, unknown>;
  created: Date;
  deleted: boolean;
  inputSchema?: Record<string, unknown>;
  outputFieldNotes?: Record<string, string>;
  outputSchema?: Record<string, unknown>;
  promptId: mongoose.Types.ObjectId;
  sensitive: boolean;
  system?: string;
  template?: string;
  type: "chat" | "text";
  updated: Date;
  variables: ObsPromptVariable[];
  version: number;
}

export interface ObsPromptVersionStatics
  extends FindExactlyOnePlugin<ObsPromptVersionDocument>,
    FindOneOrNonePlugin<ObsPromptVersionDocument> {}

export interface ObsPromptVersionModel
  extends mongoose.Model<ObsPromptVersionDocument>,
    ObsPromptVersionStatics {}

export interface ObsPromptLabelDocument extends mongoose.Document<mongoose.Types.ObjectId> {
  created: Date;
  deleted: boolean;
  label: string;
  promptId: mongoose.Types.ObjectId;
  updated: Date;
  versionId: mongoose.Types.ObjectId;
}

export interface ObsPromptLabelStatics
  extends FindExactlyOnePlugin<ObsPromptLabelDocument>,
    FindOneOrNonePlugin<ObsPromptLabelDocument> {}

export interface ObsPromptLabelModel
  extends mongoose.Model<ObsPromptLabelDocument>,
    ObsPromptLabelStatics {}

export interface ObsTraceDocument extends mongoose.Document<mongoose.Types.ObjectId> {
  created: Date;
  deleted: boolean;
  endedAt?: Date;
  errorSummary?: string;
  flaggedForDataset: boolean;
  input?: unknown;
  name: string;
  output?: unknown;
  prompts: ObsPromptRef[];
  sensitive: boolean;
  sessionId?: string;
  startedAt: Date;
  status: "error" | "ok";
  updated: Date;
  usage?: ObsPromptUsage;
  userId?: mongoose.Types.ObjectId;
}

export interface ObsTraceStatics
  extends FindExactlyOnePlugin<ObsTraceDocument>,
    FindOneOrNonePlugin<ObsTraceDocument> {}

export interface ObsTraceModel extends mongoose.Model<ObsTraceDocument>, ObsTraceStatics {}

export interface ObsSpanDocument extends mongoose.Document<mongoose.Types.ObjectId> {
  created: Date;
  deleted: boolean;
  durationMs?: number;
  endedAt?: Date;
  error?: string;
  input?: unknown;
  kind: "AGENT" | "CHAIN" | "EVALUATOR" | "LLM" | "RETRIEVER" | "TOOL";
  name: string;
  output?: unknown;
  parentSpanId?: mongoose.Types.ObjectId;
  sensitive?: boolean;
  startOffsetMs?: number;
  startedAt: Date;
  status: "error" | "ok";
  traceId: mongoose.Types.ObjectId;
  updated: Date;
  usage?: ObsPromptUsage;
}

export interface ObsSpanStatics
  extends FindExactlyOnePlugin<ObsSpanDocument>,
    FindOneOrNonePlugin<ObsSpanDocument> {}

export interface ObsSpanModel extends mongoose.Model<ObsSpanDocument>, ObsSpanStatics {}

export interface ObsScoreDocument extends mongoose.Document<mongoose.Types.ObjectId> {
  comment?: string;
  confidence?: number;
  created: Date;
  dataType: "boolean" | "categorical" | "numeric";
  deleted: boolean;
  evaluatorId?: mongoose.Types.ObjectId;
  name: string;
  source: "code" | "human" | "llm-judge" | "user-feedback";
  spanId?: mongoose.Types.ObjectId;
  traceId: mongoose.Types.ObjectId;
  updated: Date;
  value: boolean | number | string;
}

export interface ObsScoreStatics
  extends FindExactlyOnePlugin<ObsScoreDocument>,
    FindOneOrNonePlugin<ObsScoreDocument> {}

export interface ObsScoreModel extends mongoose.Model<ObsScoreDocument>, ObsScoreStatics {}
