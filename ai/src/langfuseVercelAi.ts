import {logger} from "@terreno/api";

import {getLangfuseOptions, isLangfuseInitialized} from "./langfuseClient";
import {compilePrompt, getPrompt} from "./langfusePrompts";
import type {
  ChatMessage,
  GetPromptOptions,
  LangfuseAppOptions,
  PreparePromptResult,
  TelemetrySettings,
} from "./langfuseTypes";

export const preparePromptForAI = async (
  params: {
    promptName: string;
    variables?: Record<string, string>;
    userId?: string;
    label?: string;
  },
  appOptions?: Pick<LangfuseAppOptions, "cache">
): Promise<PreparePromptResult> => {
  const options: GetPromptOptions = {
    label: params.label,
    userId: params.userId,
    variables: params.variables,
  };

  const cached = await getPrompt(params.promptName, options, appOptions);
  const compiled = compilePrompt(cached, params.variables ?? {});

  const varKeys = Object.keys(params.variables ?? {});
  logger.debug(
    `Langfuse prompt used: "${params.promptName}" v${cached.version}${varKeys.length ? ` (vars: ${varKeys.join(", ")})` : ""}${params.userId ? ` (user: ${params.userId})` : ""}`
  );

  const telemetry: PreparePromptResult["telemetry"] = {
    functionId: `prompt:${params.promptName}`,
    isEnabled: true,
    metadata: {
      langfusePromptName: params.promptName,
      langfusePromptVersion: cached.version,
      ...(params.userId ? {userId: params.userId} : {}),
    },
  };

  if (cached.type === "text") {
    return {
      config: cached.config,
      prompt: compiled as string,
      telemetry,
    };
  }

  return {
    config: cached.config,
    messages: compiled as ChatMessage[],
    telemetry,
  };
};

export const createTelemetryConfig = (params: {
  functionId: string;
  metadata?: Record<string, string | number | boolean>;
  sessionId?: string;
  tags?: string[];
  traceId?: string;
  updateParent?: boolean;
  userId?: string;
}): TelemetrySettings => {
  return {
    functionId: params.functionId,
    isEnabled: true,
    metadata: {
      ...params.metadata,
      ...(params.userId ? {userId: params.userId} : {}),
      ...(params.traceId ? {langfuseTraceId: params.traceId} : {}),
      ...(params.sessionId ? {langfuseSessionId: params.sessionId} : {}),
      ...(params.tags ? {langfuseTags: params.tags} : {}),
      ...(params.updateParent !== undefined ? {langfuseUpdateParent: params.updateParent} : {}),
    },
  };
};

/**
 * Create a Langfuse trace via REST API and return telemetry config that links AI SDK calls to it.
 * Use this to wrap an AI operation with full context (e.g. patient chart data) as the trace input.
 * The trace is created asynchronously — the returned telemetry config can be used immediately.
 *
 * @example
 * ```typescript
 * const telemetry = await createLangfuseTrace({
 *   name: "patient-chart-review",
 *   input: {userInfo, medications, notes, ...chartContext},
 *   userId: patientId.toString(),
 *   sessionId: `chart-review-${patientId}`,
 *   tags: ["chart-review", "patient-summary"],
 * });
 *
 * const result = streamText({
 *   experimental_telemetry: telemetry,
 *   messages,
 *   model,
 * });
 * ```
 */
export const createLangfuseTrace = async (params: {
  input?: unknown;
  metadata?: Record<string, unknown>;
  name: string;
  sessionId?: string;
  tags?: string[];
  userId?: string;
}): Promise<TelemetrySettings> => {
  if (!isLangfuseInitialized()) {
    logger.debug("Langfuse not initialized, returning basic telemetry config");
    return createTelemetryConfig({
      functionId: params.name,
      sessionId: params.sessionId,
      tags: params.tags,
      userId: params.userId,
    });
  }

  const options = getLangfuseOptions();
  if (!options) {
    return createTelemetryConfig({
      functionId: params.name,
      sessionId: params.sessionId,
      tags: params.tags,
      userId: params.userId,
    });
  }

  try {
    const baseUrl = options.baseUrl ?? "https://cloud.langfuse.com";
    const traceId = crypto.randomUUID();

    const body = {
      batch: [
        {
          body: {
            id: traceId,
            input: params.input,
            metadata: params.metadata,
            name: params.name,
            sessionId: params.sessionId,
            tags: params.tags,
            userId: params.userId,
          },
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          type: "trace-create" as const,
        },
      ],
    };

    const authHeader = `Basic ${btoa(`${options.publicKey}:${options.secretKey}`)}`;

    fetch(`${baseUrl}/api/public/ingestion`, {
      body: JSON.stringify(body),
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      method: "POST",
    })
      .then((res) => {
        if (!res.ok) {
          logger.warn(`Langfuse trace API returned ${res.status} ${res.statusText}`);
        }
      })
      .catch((err) => {
        logger.warn(`Failed to send Langfuse trace: ${err}`);
      });

    logger.debug(`Langfuse trace created: ${traceId} (${params.name})`);

    return createTelemetryConfig({
      functionId: params.name,
      sessionId: params.sessionId,
      tags: params.tags,
      traceId,
      updateParent: true,
      userId: params.userId,
    });
  } catch (err) {
    logger.warn(`Failed to create Langfuse trace: ${err}`);
    return createTelemetryConfig({
      functionId: params.name,
      sessionId: params.sessionId,
      tags: params.tags,
      userId: params.userId,
    });
  }
};
