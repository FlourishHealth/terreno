export interface ScoringFunction {
  name: string;
  description: string;
  scoreType: "numeric" | "categorical" | "boolean";
  categories?: string[];
  range?: {min: number; max: number};
}

export interface LangfuseAppOptions {
  secretKey: string;
  publicKey: string;
  baseUrl?: string;
  adminPath?: string;
  enableAdminUI?: boolean;
  enableTracing?: boolean;
  serviceName?: string;
  cache?: {
    promptTtlSeconds?: number;
    traceTtlSeconds?: number;
  };
  evaluation?: {
    enabled?: boolean;
    scoringFunctions?: ScoringFunction[];
  };
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface LangfuseCachedPrompt {
  name: string;
  version: number;
  type: "text" | "chat";
  prompt: string | ChatMessage[];
  config: Record<string, unknown>;
  labels: string[];
  tags: string[];
}

export interface TelemetrySettings {
  isEnabled?: boolean;
  functionId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface PreparePromptResult {
  prompt?: string;
  messages?: ChatMessage[];
  config: Record<string, unknown>;
  telemetry: TelemetrySettings;
}

export interface GetPromptOptions {
  label?: string;
  variables?: Record<string, string>;
  userId?: string;
}

export interface PromptListItem {
  name: string;
  version: number;
  type: "text" | "chat";
  labels: string[];
  tags: string[];
  createdAt: string;
}

export interface TraceListItem {
  id: string;
  name: string;
  userId?: string;
  sessionId?: string;
  timestamp: string;
  input?: unknown;
  output?: unknown;
  metadata?: Record<string, unknown>;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ScoreSubmission {
  traceId: string;
  name: string;
  value: number | string;
  comment?: string;
  dataType?: "NUMERIC" | "CATEGORICAL" | "BOOLEAN";
}
