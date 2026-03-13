import {logger} from "@terreno/api";

import {compilePrompt, getPrompt} from "./prompts";
import type {ChatMessage, GetPromptOptions, LangfuseAppOptions, PreparePromptResult} from "./types";

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
  userId?: string;
  metadata?: Record<string, string | number | boolean>;
}): PreparePromptResult["telemetry"] => {
  return {
    functionId: params.functionId,
    isEnabled: true,
    metadata: {
      ...params.metadata,
      ...(params.userId ? {userId: params.userId} : {}),
    },
  };
};
