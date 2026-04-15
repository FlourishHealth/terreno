import {beforeEach, describe, expect, it, mock} from "bun:test";

import type {LangfuseCachedPrompt} from "./langfuseTypes";

const cacheValues = new Map<string, LangfuseCachedPrompt>();

const mockLoggerDebug = mock(() => {});
const mockLoggerInfo = mock(() => {});
const mockGetCached = mock(async (key: string) => {
  return cacheValues.get(key) ?? null;
});
const mockSetCached = mock(async (key: string, value: LangfuseCachedPrompt) => {
  cacheValues.set(key, value);
});
const mockInvalidateCache = mock(async (prefix: string) => {
  const keys = [...cacheValues.keys()];
  for (const key of keys) {
    if (key.startsWith(prefix)) {
      cacheValues.delete(key);
    }
  }
});
const mockPromptCreate = mock(async (_params: Record<string, unknown>) => {});
const mockPromptGet = mock(async (_name: string, _options?: Record<string, unknown>) => ({
  config: {},
  labels: ["production"],
  name: "test-prompt",
  prompt: "Hello world",
  tags: [],
  type: "text" as const,
  version: 1,
}));

mock.module("@terreno/api", () => ({
  logger: {
    debug: mockLoggerDebug,
    info: mockLoggerInfo,
  },
}));

mock.module("./langfuseCache", () => ({
  getCached: mockGetCached,
  invalidateCache: mockInvalidateCache,
  setCached: mockSetCached,
}));

mock.module("./langfuseClient", () => ({
  getLangfuseClient: () => ({prompt: {create: mockPromptCreate, get: mockPromptGet}}),
}));

const {compilePrompt, createPrompt, getPrompt, invalidatePromptCache} = await import(
  "./langfusePrompts"
);

const textPrompt: LangfuseCachedPrompt = {
  config: {},
  labels: ["production"],
  name: "test-prompt",
  prompt: "Hello {{name}}, you are {{age}} years old.",
  tags: [],
  type: "text",
  version: 1,
};

const chatPrompt: LangfuseCachedPrompt = {
  config: {},
  labels: ["production"],
  name: "chat-prompt",
  prompt: [
    {content: "You are a helpful assistant for {{company}}.", role: "system"},
    {content: "My name is {{name}}.", role: "user"},
  ],
  tags: [],
  type: "chat",
  version: 1,
};

beforeEach(() => {
  cacheValues.clear();
  mockLoggerDebug.mockClear();
  mockLoggerInfo.mockClear();
  mockGetCached.mockClear();
  mockSetCached.mockClear();
  mockInvalidateCache.mockClear();
  mockPromptCreate.mockClear();
  mockPromptGet.mockClear();
  mockPromptGet.mockImplementation(async () => ({
    config: {},
    labels: ["production"],
    name: "test-prompt",
    prompt: "Hello world",
    tags: [],
    type: "text" as const,
    version: 1,
  }));
});

describe("compilePrompt", () => {
  it("replaces variables in text prompts", () => {
    const result = compilePrompt(textPrompt, {age: "30", name: "Alice"});
    expect(result).toBe("Hello Alice, you are 30 years old.");
  });

  it("keeps missing text variables unreplaced", () => {
    const result = compilePrompt(textPrompt, {name: "Alice"});
    expect(result).toBe("Hello Alice, you are {{age}} years old.");
  });

  it("replaces variables in chat prompts", () => {
    const result = compilePrompt(chatPrompt, {company: "Acme", name: "Bob"}) as Array<{
      content: string;
      role: string;
    }>;

    expect(result[0]).toEqual({content: "You are a helpful assistant for Acme.", role: "system"});
    expect(result[1]).toEqual({content: "My name is Bob.", role: "user"});
  });
});

describe("getPrompt", () => {
  it("returns cached prompts without calling Langfuse", async () => {
    cacheValues.set("prompt:test-prompt:production", textPrompt);

    const result = await getPrompt("test-prompt");

    expect(result).toEqual(textPrompt);
    expect(mockPromptGet).toHaveBeenCalledTimes(0);
    expect(mockLoggerDebug).toHaveBeenCalledWith(
      'Langfuse prompt cache hit: "test-prompt" v1 (label: production)'
    );
  });

  it("fetches and caches prompts with default ttl/label", async () => {
    const result = await getPrompt("test-prompt");

    expect(mockPromptGet).toHaveBeenCalledWith("test-prompt", {
      cacheTtlSeconds: 0,
      label: "production",
    });
    expect(mockSetCached).toHaveBeenCalledWith("prompt:test-prompt:production", result, 60);
    expect(cacheValues.get("prompt:test-prompt:production")).toEqual(result);
  });

  it("fetches and caches prompts with custom ttl/label", async () => {
    await getPrompt("test-prompt", {label: "staging"}, {cache: {promptTtlSeconds: 120}});

    expect(mockPromptGet).toHaveBeenCalledWith("test-prompt", {
      cacheTtlSeconds: 0,
      label: "staging",
    });
    expect(mockSetCached).toHaveBeenCalledWith(
      "prompt:test-prompt:staging",
      {
        config: {},
        labels: ["production"],
        name: "test-prompt",
        prompt: "Hello world",
        tags: [],
        type: "text",
        version: 1,
      },
      120
    );
  });

  it("throws when Langfuse fetch fails", async () => {
    mockPromptGet.mockImplementation(async () => {
      throw new Error("Prompt not found");
    });

    await expect(getPrompt("missing-prompt")).rejects.toThrow("Prompt not found");
  });
});

describe("createPrompt", () => {
  it("creates text prompts with default labels/tags", async () => {
    const result = await createPrompt({
      name: "created-prompt",
      prompt: "Text prompt body",
      type: "text",
    });

    expect(mockPromptCreate).toHaveBeenCalledWith({
      config: undefined,
      labels: ["production"],
      name: "created-prompt",
      prompt: "Text prompt body",
      tags: [],
      type: "text",
    });
    expect(mockInvalidateCache).toHaveBeenCalledWith("prompt:created-prompt:");
    expect(mockPromptGet).toHaveBeenCalledWith("created-prompt", {
      cacheTtlSeconds: 0,
      label: "production",
    });
    expect(result.name).toBe("test-prompt");
  });

  it("creates chat prompts preserving role and content", async () => {
    await createPrompt({
      config: {temperature: 0.3},
      labels: ["staging"],
      name: "chat-prompt",
      prompt: [
        {content: "System says hello", role: "system"},
        {content: "User asks question", role: "user"},
      ],
      tags: ["support"],
      type: "chat",
    });

    expect(mockPromptCreate).toHaveBeenCalledWith({
      config: {temperature: 0.3},
      labels: ["staging"],
      name: "chat-prompt",
      prompt: [
        {content: "System says hello", role: "system"},
        {content: "User asks question", role: "user"},
      ],
      tags: ["support"],
      type: "chat",
    });
  });
});

describe("invalidatePromptCache", () => {
  it("invalidates cache entries for a prompt prefix", async () => {
    cacheValues.set("prompt:target-prompt:production", textPrompt);
    cacheValues.set("prompt:target-prompt:staging", textPrompt);
    cacheValues.set("prompt:other-prompt:production", textPrompt);

    await invalidatePromptCache("target-prompt");

    expect(mockInvalidateCache).toHaveBeenCalledWith("prompt:target-prompt:");
    expect(cacheValues.has("prompt:target-prompt:production")).toBe(false);
    expect(cacheValues.has("prompt:target-prompt:staging")).toBe(false);
    expect(cacheValues.has("prompt:other-prompt:production")).toBe(true);
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      "Langfuse prompt cache invalidated for: target-prompt"
    );
  });
});
