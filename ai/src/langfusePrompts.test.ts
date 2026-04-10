import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";

import type {LangfuseCachedPrompt} from "./langfuseTypes";

const mockPromptCreate = mock(async (_params: Record<string, unknown>) => ({}));

const mockPromptGet = mock(async (_name: string, _options?: Record<string, unknown>) => ({
  config: {},
  labels: ["production"],
  name: "test-prompt",
  prompt: "Hello world",
  tags: [],
  type: "text" as const,
  version: 1,
}));

mock.module("./langfuseClient", () => ({
  getLangfuseClient: () => ({prompt: {create: mockPromptCreate, get: mockPromptGet}}),
}));

interface CachedPromptEntry {
  expiresAtMs: number;
  value: LangfuseCachedPrompt;
}

const promptCache = new Map<string, CachedPromptEntry>();

const clearPromptCache = (): void => {
  promptCache.clear();
};

const countPromptCacheKeys = (keyPattern?: string): number => {
  if (!keyPattern) {
    return promptCache.size;
  }

  const regex = new RegExp(keyPattern);
  return [...promptCache.keys()].filter((key) => regex.test(key)).length;
};

const getSecondsUntilExpiry = (key: string): number | null => {
  const cached = promptCache.get(key);
  if (!cached) {
    return null;
  }
  return (cached.expiresAtMs - Date.now()) / 1000;
};

const seedPromptCache = (params: {
  key: string;
  ttlSeconds: number;
  value: LangfuseCachedPrompt;
}): void => {
  promptCache.set(params.key, {
    expiresAtMs: Date.now() + params.ttlSeconds * 1000,
    value: params.value,
  });
};

mock.module("./langfuseCache", () => ({
  getCached: async (key: string) => {
    const cached = promptCache.get(key);
    if (!cached) {
      return null;
    }
    if (cached.expiresAtMs <= Date.now()) {
      promptCache.delete(key);
      return null;
    }
    return cached.value;
  },
  invalidateCache: async (keyPattern: string) => {
    const regex = new RegExp(keyPattern);
    for (const key of promptCache.keys()) {
      if (regex.test(key)) {
        promptCache.delete(key);
      }
    }
  },
  setCached: async (key: string, value: LangfuseCachedPrompt, ttlSeconds: number) => {
    promptCache.set(key, {
      expiresAtMs: Date.now() + ttlSeconds * 1000,
      value,
    });
  },
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

describe("compilePrompt", () => {
  describe("text prompts", () => {
    it("replaces variables in a text prompt", () => {
      const result = compilePrompt(textPrompt, {age: "30", name: "Alice"});
      expect(result).toBe("Hello Alice, you are 30 years old.");
    });

    it("leaves unreplaced variables as-is when not provided", () => {
      const result = compilePrompt(textPrompt, {name: "Alice"});
      expect(result).toBe("Hello Alice, you are {{age}} years old.");
    });

    it("returns prompt unchanged when no variables provided", () => {
      const noVarPrompt: LangfuseCachedPrompt = {
        ...textPrompt,
        prompt: "Hello world.",
      };
      const result = compilePrompt(noVarPrompt);
      expect(result).toBe("Hello world.");
    });
  });

  describe("chat prompts", () => {
    it("replaces variables in all chat messages", () => {
      const result = compilePrompt(chatPrompt, {company: "Acme", name: "Bob"});
      expect(Array.isArray(result)).toBe(true);
      const messages = result as Array<{role: string; content: string}>;
      expect(messages[0].content).toBe("You are a helpful assistant for Acme.");
      expect(messages[1].content).toBe("My name is Bob.");
    });

    it("preserves roles in chat messages", () => {
      const result = compilePrompt(chatPrompt, {company: "X", name: "Y"}) as Array<{
        role: string;
        content: string;
      }>;
      expect(result[0].role).toBe("system");
      expect(result[1].role).toBe("user");
    });
  });
});

describe("getPrompt", () => {
  beforeEach(async () => {
    clearPromptCache();
    mockPromptCreate.mockClear();
    mockPromptGet.mockClear();
    mockPromptGet.mockImplementation(async (name: string, _options?: Record<string, unknown>) => ({
      config: {},
      labels: ["production"],
      name,
      prompt: "Hello world",
      tags: [],
      type: "text" as const,
      version: 1,
    }));
  });

  afterEach(async () => {
    clearPromptCache();
  });

  it("fetches from Langfuse when cache is empty", async () => {
    const result = await getPrompt("test-prompt");
    expect(result.name).toBe("test-prompt");
    expect(result.type).toBe("text");
    expect(mockPromptGet).toHaveBeenCalledTimes(1);
  });

  it("returns cached result on second call", async () => {
    await getPrompt("test-prompt");
    await getPrompt("test-prompt");
    expect(mockPromptGet).toHaveBeenCalledTimes(1);
  });

  it("passes production label by default", async () => {
    await getPrompt("test-prompt");
    expect(mockPromptGet).toHaveBeenCalledWith("test-prompt", {
      cacheTtlSeconds: 0,
      label: "production",
    });
  });

  it("uses a custom label for both cache key and fetch", async () => {
    await getPrompt("test-prompt", {label: "staging"});
    await getPrompt("test-prompt", {label: "staging"});

    expect(mockPromptGet).toHaveBeenCalledTimes(1);
    expect(mockPromptGet).toHaveBeenCalledWith("test-prompt", {
      cacheTtlSeconds: 0,
      label: "staging",
    });

    const countAfter = countPromptCacheKeys("^prompt:test-prompt:staging$");
    expect(countAfter).toBe(1);
  });

  it("uses different cache keys for different labels", async () => {
    await getPrompt("test-prompt", {label: "production"});
    await getPrompt("test-prompt", {label: "staging"});
    expect(mockPromptGet).toHaveBeenCalledTimes(2);
  });

  it("writes fetched prompt to cache", async () => {
    await getPrompt("test-prompt");
    const countAfter = countPromptCacheKeys("^prompt:test-prompt:production$");
    expect(countAfter).toBe(1);
  });

  it("respects a custom prompt cache TTL", async () => {
    await getPrompt("ttl-prompt", {}, {cache: {promptTtlSeconds: 5}});
    const remainingSeconds = getSecondsUntilExpiry("prompt:ttl-prompt:production");
    expect(remainingSeconds).not.toBeNull();
    expect(remainingSeconds ?? 0).toBeGreaterThan(0);
    expect(remainingSeconds).toBeLessThanOrEqual(6);
  });

  it("throws when Langfuse fetch fails", async () => {
    mockPromptGet.mockImplementation(async () => {
      throw new Error("Prompt not found");
    });

    await expect(getPrompt("missing-prompt")).rejects.toThrow("Prompt not found");
  });
});

describe("createPrompt", () => {
  beforeEach(async () => {
    clearPromptCache();
    mockPromptCreate.mockClear();
    mockPromptGet.mockClear();
    mockPromptGet.mockImplementation(async (name: string, _options?: Record<string, unknown>) => ({
      config: {},
      labels: ["production"],
      name,
      prompt: "Hello world",
      tags: [],
      type: "text" as const,
      version: 2,
    }));
  });

  afterEach(async () => {
    clearPromptCache();
  });

  it("creates text prompts with default labels and tags", async () => {
    const result = await createPrompt({
      name: "new-text-prompt",
      prompt: "hello there",
      type: "text",
    });

    expect(mockPromptCreate).toHaveBeenCalledWith({
      config: undefined,
      labels: ["production"],
      name: "new-text-prompt",
      prompt: "hello there",
      tags: [],
      type: "text",
    });
    expect(result.name).toBe("new-text-prompt");
    expect(result.version).toBe(2);
  });

  it("creates chat prompts, invalidates old cache entries, and refetches", async () => {
    seedPromptCache({
      key: "prompt:chat-prompt:production",
      ttlSeconds: 60,
      value: textPrompt,
    });
    seedPromptCache({
      key: "prompt:chat-prompt:staging",
      ttlSeconds: 60,
      value: textPrompt,
    });
    seedPromptCache({
      key: "prompt:other-prompt:production",
      ttlSeconds: 60,
      value: textPrompt,
    });

    const chatMessages = [
      {content: "You are helpful", role: "system"},
      {content: "Summarize this text", role: "user"},
    ];

    await createPrompt({
      config: {temperature: 0.2},
      labels: ["staging"],
      name: "chat-prompt",
      prompt: chatMessages,
      tags: ["support"],
      type: "chat",
    });

    expect(mockPromptCreate).toHaveBeenCalledWith({
      config: {temperature: 0.2},
      labels: ["staging"],
      name: "chat-prompt",
      prompt: chatMessages,
      tags: ["support"],
      type: "chat",
    });

    const remainingStaging = countPromptCacheKeys("^prompt:chat-prompt:staging$");
    const remainingProduction = countPromptCacheKeys("^prompt:chat-prompt:production$");
    const remainingOther = countPromptCacheKeys("^prompt:other-prompt:production$");
    expect(remainingStaging).toBe(0);
    expect(remainingProduction).toBe(1);
    expect(remainingOther).toBe(1);
    expect(mockPromptGet).toHaveBeenCalledWith("chat-prompt", {
      cacheTtlSeconds: 0,
      label: "production",
    });
  });
});

describe("invalidatePromptCache", () => {
  beforeEach(async () => {
    clearPromptCache();
  });

  afterEach(async () => {
    clearPromptCache();
  });

  it("invalidates all labels for a prompt name", async () => {
    seedPromptCache({
      key: "prompt:email-template:production",
      ttlSeconds: 60,
      value: textPrompt,
    });
    seedPromptCache({
      key: "prompt:email-template:staging",
      ttlSeconds: 60,
      value: textPrompt,
    });
    seedPromptCache({
      key: "prompt:another-template:production",
      ttlSeconds: 60,
      value: textPrompt,
    });

    await invalidatePromptCache("email-template");

    const emailTemplateEntries = countPromptCacheKeys("^prompt:email-template:");
    const otherTemplateEntries = countPromptCacheKeys("^prompt:another-template:");

    expect(emailTemplateEntries).toBe(0);
    expect(otherTemplateEntries).toBe(1);
  });
});
