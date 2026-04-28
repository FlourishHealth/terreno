export interface ScoringFunction {
  categories?: string[];
  description: string;
  name: string;
  range?: {max: number; min: number};
  scoreType: "numeric" | "categorical" | "boolean";
}

export interface LangfuseAppOptions {
  adminPath?: string;
  baseUrl?: string;
  cache?: {
    promptTtlSeconds?: number;
    traceTtlSeconds?: number;
  };
  enableAdminUI?: boolean;
  enableTracing?: boolean;
  evaluation?: {
    enabled?: boolean;
    scoringFunctions?: ScoringFunction[];
  };
  /** Organization slug in Langfuse (default: "flourish-health") */
  organization?: string;
  /** Project name/slug in Langfuse (default: "terreno") */
  project?: string;
  /** Langfuse project ID (UUID) for trace URLs; optional, keys usually imply project */
  projectId?: string;
  publicKey: string;
  secretKey: string;
  serviceName?: string;
}

export interface ChatMessage {
  content: string;
  role: string;
}

export interface LangfuseCachedPrompt {
  config: Record<string, unknown>;
  labels: string[];
  name: string;
  prompt: string | ChatMessage[];
  tags: string[];
  type: "text" | "chat";
  version: number;
}

export interface TelemetrySettings {
  functionId?: string;
  isEnabled?: boolean;
  metadata?: Record<string, string | number | boolean>;
}

export interface PreparePromptResult {
  config: Record<string, unknown>;
  messages?: ChatMessage[];
  prompt?: string;
  telemetry: TelemetrySettings;
}

export interface GetPromptOptions {
  label?: string;
  userId?: string;
  variables?: Record<string, string>;
}

export interface PromptListItem {
  createdAt: string;
  labels: string[];
  name: string;
  tags: string[];
  type: "text" | "chat";
  version: number;
}

export interface TraceListItem {
  id: string;
  input?: unknown;
  metadata?: Record<string, unknown>;
  name: string;
  output?: unknown;
  sessionId?: string;
  timestamp: string;
  userId?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    limit: number;
    page: number;
    total: number;
    totalPages: number;
  };
}

export interface ScoreSubmission {
  comment?: string;
  dataType?: "NUMERIC" | "CATEGORICAL" | "BOOLEAN";
  name: string;
  traceId: string;
  value: number | string;
}
