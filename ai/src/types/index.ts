import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "@terreno/api";
import type {LanguageModel} from "ai";
import type mongoose from "mongoose";

// ============================================================
// AIRequest Types
// ============================================================

export const AI_REQUEST_TYPES = ["general", "remix", "summarization", "translation"] as const;
export type AIRequestType = (typeof AI_REQUEST_TYPES)[number];

export type AIRequestDocument = mongoose.Document<mongoose.Types.ObjectId> & {
  created: Date;
  deleted: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
  aiModel: string;
  prompt: string;
  requestType: AIRequestType;
  response?: string;
  responseTime?: number;
  tokensUsed?: number;
  updated: Date;
  userId?: mongoose.Types.ObjectId;
};

export interface AIRequestStatics
  extends FindExactlyOnePlugin<AIRequestDocument>,
    FindOneOrNonePlugin<AIRequestDocument> {
  logRequest(params: LogRequestParams): Promise<AIRequestDocument>;
}

export type AIRequestModel = mongoose.Model<AIRequestDocument> & AIRequestStatics;

export interface LogRequestParams {
  error?: string;
  metadata?: Record<string, unknown>;
  aiModel: string;
  prompt: string;
  requestType: AIRequestType;
  response?: string;
  responseTime?: number;
  tokensUsed?: number;
  userId?: mongoose.Types.ObjectId;
}

// ============================================================
// GptHistory Types
// ============================================================

export interface GptHistoryPrompt {
  model?: string;
  text: string;
  type: "user" | "assistant" | "system";
}

export type GptHistoryDocument = mongoose.Document<mongoose.Types.ObjectId> & {
  created: Date;
  deleted: boolean;
  prompts: GptHistoryPrompt[];
  title?: string;
  updated: Date;
  userId: mongoose.Types.ObjectId;
};

export interface GptHistoryStatics
  extends FindExactlyOnePlugin<GptHistoryDocument>,
    FindOneOrNonePlugin<GptHistoryDocument> {}

export type GptHistoryModel = mongoose.Model<GptHistoryDocument> & GptHistoryStatics;

// ============================================================
// AI Service Types
// ============================================================

export interface AIServiceOptions {
  defaultTemperature?: number;
  model: LanguageModel;
}

export interface GenerateTextOptions {
  maxTokens?: number;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  userId?: mongoose.Types.ObjectId;
}

export interface GenerateStreamOptions {
  maxTokens?: number;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  userId?: mongoose.Types.ObjectId;
}

export interface GenerateChatStreamOptions {
  messages: Array<{content: string; role: "user" | "assistant" | "system"}>;
  systemPrompt?: string;
  userId?: mongoose.Types.ObjectId;
}

export interface RemixOptions {
  text: string;
  userId?: mongoose.Types.ObjectId;
}

export interface SummaryOptions {
  text: string;
  userId?: mongoose.Types.ObjectId;
}

export interface TranslateOptions {
  sourceLanguage?: string;
  targetLanguage: string;
  text: string;
  userId?: mongoose.Types.ObjectId;
}

// ============================================================
// Route Option Types
// ============================================================

export interface GptRouteOptions {
  aiService: import("../service/aiService").AIService;
  openApiOptions?: Record<string, unknown>;
}

export interface GptHistoryRouteOptions {
  openApiOptions?: Record<string, unknown>;
}

export interface AiRequestsExplorerRouteOptions {
  openApiOptions?: Record<string, unknown>;
}
