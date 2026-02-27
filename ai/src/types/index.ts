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
// Content Part Types (Multi-modal)
// ============================================================

export interface TextContentPart {
  type: "text";
  text: string;
}

export interface ImageContentPart {
  type: "image";
  url: string;
  mimeType?: string;
}

export interface FileContentPart {
  type: "file";
  url: string;
  filename?: string;
  mimeType: string;
}

export type MessageContentPart = TextContentPart | ImageContentPart | FileContentPart;

// ============================================================
// GptHistory Types
// ============================================================

export interface GptHistoryPrompt {
  model?: string;
  rating?: "up" | "down";
  text: string;
  type: "user" | "assistant" | "system" | "tool-call" | "tool-result";
  content?: MessageContentPart[];
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
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
  maxOutputTokens?: number;
  prompt: string;
  stopWhen?: import("ai").StopCondition<any>;
  systemPrompt?: string;
  temperature?: number;
  toolChoice?: "auto" | "none" | "required";
  tools?: Record<string, import("ai").Tool>;
  userId?: mongoose.Types.ObjectId;
}

export interface GenerateStreamOptions {
  maxOutputTokens?: number;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  userId?: mongoose.Types.ObjectId;
}

export interface GenerateChatStreamOptions {
  messages: Array<{content: string; role: "user" | "assistant" | "system"}>;
  stopWhen?: import("ai").StopCondition<any>;
  systemPrompt?: string;
  toolChoice?: "auto" | "none" | "required";
  tools?: Record<string, import("ai").Tool>;
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
  /** Pre-configured AIService. Optional when using per-request keys or demo mode. */
  aiService?: import("../service/aiService").AIService;
  /** Factory to create a LanguageModel from a per-request API key (x-ai-api-key header). */
  createModelFn?: (apiKey: string, modelId?: string) => import("ai").LanguageModel;
  /** Factory to create per-request tools (e.g. tools that need the request's API key). Merged with static tools. */
  createRequestTools?: (req: import("express").Request) => Record<string, import("ai").Tool>;
  /** Return canned responses when no AI service is available. */
  demoMode?: boolean;
  mcpService?: import("../service/mcpService").MCPService;
  openApiOptions?: Record<string, unknown>;
  tools?: Record<string, import("ai").Tool>;
  toolChoice?: "auto" | "none" | "required";
  maxSteps?: number;
}

export interface GptHistoryRouteOptions {
  openApiOptions?: Record<string, unknown>;
}

export interface AiRequestsExplorerRouteOptions {
  openApiOptions?: Record<string, unknown>;
}

export interface FileRouteOptions {
  gcsBucket: string;
  maxFileSize?: number;
  openApiOptions?: Record<string, unknown>;
}

export interface McpRouteOptions {
  mcpService: import("../service/mcpService").MCPService;
  openApiOptions?: Record<string, unknown>;
}

// ============================================================
// File Attachment Types
// ============================================================

export interface FileAttachmentDocument extends mongoose.Document<mongoose.Types.ObjectId> {
  created: Date;
  deleted: boolean;
  filename: string;
  gcsKey: string;
  mimeType: string;
  size: number;
  updated: Date;
  url: string;
  userId: mongoose.Types.ObjectId;
}

export interface FileAttachmentStatics
  extends FindExactlyOnePlugin<FileAttachmentDocument>,
    FindOneOrNonePlugin<FileAttachmentDocument> {}

export type FileAttachmentModel = mongoose.Model<FileAttachmentDocument> & FileAttachmentStatics;

// ============================================================
// MCP Types
// ============================================================

export interface MCPServerConfig {
  name: string;
  transport: {type: "sse"; url: string; headers?: Record<string, string>};
}
