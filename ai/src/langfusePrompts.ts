import {logger} from "@terreno/api";
import type {
  CreateChatPromptBody,
  CreateTextPromptBody,
  GetLangfusePromptSuccessData,
} from "langfuse-core";

import {getCached, invalidateCache, setCached} from "./langfuseCache";
import {getLangfuseClient} from "./langfuseClient";
import type {
  ChatMessage,
  GetPromptOptions,
  LangfuseAppOptions,
  LangfuseCachedPrompt,
} from "./langfuseTypes";

const DEFAULT_PROMPT_TTL = 60;

const DEFAULT_LABEL = "production";

const buildPromptCacheKey = (name: string, label?: string): string => {
  return `prompt:${name}:${label ?? DEFAULT_LABEL}`;
};

const toLatestVersion = (data: GetLangfusePromptSuccessData): LangfuseCachedPrompt => {
  const base = {
    config: (data.config ?? {}) as Record<string, unknown>,
    labels: data.labels ?? [],
    name: data.name,
    tags: data.tags ?? [],
    version: data.version,
  };

  if (data.type === "chat") {
    return {
      ...base,
      prompt: data.prompt as ChatMessage[],
      type: "chat",
    };
  }

  return {
    ...base,
    prompt: data.prompt as string,
    type: "text",
  };
};

export const getPrompt = async (
  name: string,
  options: GetPromptOptions = {},
  appOptions?: Pick<LangfuseAppOptions, "cache">
): Promise<LangfuseCachedPrompt> => {
  const ttl = appOptions?.cache?.promptTtlSeconds ?? DEFAULT_PROMPT_TTL;
  const cacheKey = buildPromptCacheKey(name, options.label);

  const cached = await getCached(cacheKey);
  if (cached) {
    logger.debug(
      `Langfuse prompt cache hit: "${name}" v${cached.version} (label: ${options.label ?? DEFAULT_LABEL})`
    );
    return cached;
  }

  logger.info(
    `Langfuse prompt cache miss: fetching "${name}" from API (label: ${options.label ?? DEFAULT_LABEL})`
  );
  const client = getLangfuseClient();
  const result = await client.getPromptStateless(name, undefined, options.label);

  if (result.fetchResult !== "success") {
    logger.warn(
      `Langfuse prompt fetch failed: "${name}" — ${result.data.message ?? "unknown error"}`
    );
    throw new Error(`Failed to fetch prompt "${name}": ${result.data.message ?? "unknown error"}`);
  }

  const cachedPrompt = toLatestVersion(result.data);
  logger.info(`Langfuse prompt fetched: "${name}" v${cachedPrompt.version} (ttl: ${ttl}s)`);
  await setCached(cacheKey, cachedPrompt, ttl);
  return cachedPrompt;
};

export const compilePrompt = (
  cached: LangfuseCachedPrompt,
  variables: Record<string, string> = {}
): string | ChatMessage[] => {
  const replace = (template: string): string => {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      return variables[key] ?? `{{${key}}}`;
    });
  };

  if (cached.type === "text") {
    return replace(cached.prompt as string);
  }

  return (cached.prompt as ChatMessage[]).map((msg) => ({
    content: replace(msg.content),
    role: msg.role,
  }));
};

export const createPrompt = async (params: {
  name: string;
  type: "text" | "chat";
  prompt: string | ChatMessage[];
  labels?: string[];
  tags?: string[];
  config?: Record<string, unknown>;
}): Promise<LangfuseCachedPrompt> => {
  const client = getLangfuseClient();

  if (params.type === "text") {
    const body: CreateTextPromptBody = {
      config: params.config,
      isActive: true,
      labels: params.labels ?? [DEFAULT_LABEL],
      name: params.name,
      prompt: params.prompt as string,
      tags: params.tags ?? [],
      type: "text",
    };
    await client.createPrompt(body);
  } else {
    const chatMessages = (params.prompt as ChatMessage[]).map((msg) => ({
      content: msg.content,
      role: msg.role,
      type: "chatmessage" as const,
    }));
    const body: CreateChatPromptBody = {
      config: params.config,
      isActive: true,
      labels: params.labels ?? [DEFAULT_LABEL],
      name: params.name,
      prompt: chatMessages,
      tags: params.tags ?? [],
      type: "chat",
    };
    await client.createPrompt(body);
  }

  await invalidatePromptCache(params.name);
  return getPrompt(params.name, {label: DEFAULT_LABEL});
};

export const invalidatePromptCache = async (name: string): Promise<void> => {
  await invalidateCache(`prompt:${name}:`);
  logger.info(`Langfuse prompt cache invalidated for: ${name}`);
};
