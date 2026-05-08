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

/**
 * Telemetry configuration for AI SDK calls with Langfuse integration.
 *
 * The `functionId`, `isEnabled`, and `metadata` fields are passed directly to the
 * Vercel AI SDK's `experimental_telemetry`. The remaining fields (`sessionId`, `tags`,
 * `traceId`, `updateParent`) are **only consumed by `createTelemetryConfig` /
 * `createLangfuseTrace`**, which map them into the appropriate `metadata` keys
 * (e.g. `langfuseTraceId`, `langfuseSessionId`). Setting them on a raw object passed
 * directly to `experimental_telemetry` will have no effect — always use the builder
 * functions.
 */
export interface TelemetrySettings {
  functionId?: string;
  isEnabled?: boolean;
  metadata?: Record<string, string | number | boolean | string[]>;
  /** Only used by `createTelemetryConfig` — mapped to `metadata.langfuseSessionId`. */
  sessionId?: string;
  /** Only used by `createTelemetryConfig` — mapped to `metadata.langfuseTags`. */
  tags?: string[];
  /** Only used by `createTelemetryConfig` — mapped to `metadata.langfuseTraceId`. */
  traceId?: string;
  /** Only used by `createTelemetryConfig` — mapped to `metadata.langfuseUpdateParent`. */
  updateParent?: boolean;
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
