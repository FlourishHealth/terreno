import {logger} from "@terreno/api";

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
  const prompt = await client.prompt.get(name, {
    cacheTtlSeconds: 0,
    label: options.label ?? DEFAULT_LABEL,
  });

  const cachedPrompt: LangfuseCachedPrompt = {
    config: (prompt.config ?? {}) as Record<string, unknown>,
    labels: prompt.labels ?? [],
    name: prompt.name,
    prompt: prompt.prompt as string | ChatMessage[],
    tags: prompt.tags ?? [],
    type: prompt.type as "text" | "chat",
    version: prompt.version,
  };

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
    await client.prompt.create({
      config: params.config,
      labels: params.labels ?? [DEFAULT_LABEL],
      name: params.name,
      prompt: params.prompt as string,
      tags: params.tags ?? [],
      type: "text",
    });
  } else {
    const chatMessages = (params.prompt as ChatMessage[]).map((msg) => ({
      content: msg.content,
      role: msg.role,
    }));
    await client.prompt.create({
      config: params.config,
      labels: params.labels ?? [DEFAULT_LABEL],
      name: params.name,
      prompt: chatMessages,
      tags: params.tags ?? [],
      type: "chat",
    });
  }

  await invalidatePromptCache(params.name);
  return getPrompt(params.name, {label: DEFAULT_LABEL});
};

export const invalidatePromptCache = async (name: string): Promise<void> => {
  await invalidateCache(`prompt:${name}:`);
  logger.info(`Langfuse prompt cache invalidated for: ${name}`);
};
