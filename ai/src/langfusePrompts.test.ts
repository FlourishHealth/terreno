import {beforeEach, describe, expect, it, mock} from "bun:test";

import type {LangfuseCachedPrompt} from "./langfuseTypes";

const mockGetCached = mock(async (_key: string) => null as LangfuseCachedPrompt | null);
const mockSetCached = mock(
  async (_key: string, _value: LangfuseCachedPrompt, _ttlSeconds: number) => {}
);
const mockInvalidateCache = mock(async (_keyPattern: string) => {});
const mockPromptGet = mock(async (_name: string, _options?: Record<string, unknown>) => ({
  config: {},
  labels: ["production"],
  name: "test-prompt",
  prompt: "Hello world",
  tags: [],
  type: "text" as const,
  version: 1,
}));
const mockPromptCreate = mock(async (_params: Record<string, unknown>) => {});

mock.module("@terreno/api", () => ({
  logger: {
    debug: mock(() => {}),
    info: mock(() => {}),
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

const {compilePrompt, createPrompt, getPrompt, invalidatePromptCache} = await import("./langfusePrompts");

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
  mockGetCached.mockClear();
  mockSetCached.mockClear();
  mockInvalidateCache.mockClear();
  mockPromptGet.mockClear();
  mockPromptCreate.mockClear();

  mockGetCached.mockImplementation(async (_key: string) => null);
  mockPromptGet.mockImplementation(async (_name: string, _options?: Record<string, unknown>) => ({
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
  it("replaces variables in a text prompt", () => {
    const result = compilePrompt(textPrompt, {age: "30", name: "Alice"});
    expect(result).toBe("Hello Alice, you are 30 years old.");
  });

  it("leaves unreplaced variables as-is when not provided", () => {
    const result = compilePrompt(textPrompt, {name: "Alice"});
    expect(result).toBe("Hello Alice, you are {{age}} years old.");
  });

  it("replaces variables across chat messages while preserving roles", () => {
    const result = compilePrompt(chatPrompt, {company: "Acme", name: "Bob"}) as Array<{
      content: string;
      role: string;
    }>;
    expect(result).toEqual([
      {content: "You are a helpful assistant for Acme.", role: "system"},
      {content: "My name is Bob.", role: "user"},
    ]);
  });
});

describe("getPrompt", () => {
  it("returns cached prompt without calling API", async () => {
    mockGetCached.mockImplementation(async () => textPrompt);

    const result = await getPrompt("test-prompt");

    expect(result).toEqual(textPrompt);
    expect(mockPromptGet).toHaveBeenCalledTimes(0);
    expect(mockSetCached).toHaveBeenCalledTimes(0);
  });

  it("fetches from Langfuse and stores prompt in cache", async () => {
    const result = await getPrompt("test-prompt");

    expect(result.name).toBe("test-prompt");
    expect(mockGetCached).toHaveBeenCalledWith("prompt:test-prompt:production");
    expect(mockPromptGet).toHaveBeenCalledWith("test-prompt", {cacheTtlSeconds: 0, label: "production"});
    expect(mockSetCached).toHaveBeenCalledWith("prompt:test-prompt:production", result, 60);
  });

  it("uses custom label and custom cache ttl", async () => {
    await getPrompt("custom-prompt", {label: "staging"}, {cache: {promptTtlSeconds: 5}});

    expect(mockGetCached).toHaveBeenCalledWith("prompt:custom-prompt:staging");
    expect(mockPromptGet).toHaveBeenCalledWith("custom-prompt", {cacheTtlSeconds: 0, label: "staging"});
    expect(mockSetCached.mock.calls[0][2]).toBe(5);
  });

  it("throws when Langfuse fetch fails", async () => {
    mockPromptGet.mockImplementation(async () => {
      throw new Error("Prompt not found");
    });

    await expect(getPrompt("missing-prompt")).rejects.toThrow("Prompt not found");
  });
});

describe("createPrompt", () => {
  it("creates a text prompt with defaults then refreshes cache", async () => {
    await createPrompt({
      name: "create-text",
      prompt: "Hello {{name}}",
      type: "text",
    });

    expect(mockPromptCreate).toHaveBeenCalledWith({
      config: undefined,
      labels: ["production"],
      name: "create-text",
      prompt: "Hello {{name}}",
      tags: [],
      type: "text",
    });
    expect(mockInvalidateCache).toHaveBeenCalledWith("prompt:create-text:");
    expect(mockPromptGet).toHaveBeenCalledWith("create-text", {cacheTtlSeconds: 0, label: "production"});
  });

  it("creates chat prompt with provided metadata", async () => {
    await createPrompt({
      config: {temperature: 0.2},
      labels: ["staging"],
      name: "create-chat",
      prompt: [{content: "Hi {{name}}", role: "user"}],
      tags: ["assistant"],
      type: "chat",
    });

    expect(mockPromptCreate).toHaveBeenCalledWith({
      config: {temperature: 0.2},
      labels: ["staging"],
      name: "create-chat",
      prompt: [{content: "Hi {{name}}", role: "user"}],
      tags: ["assistant"],
      type: "chat",
    });
    expect(mockInvalidateCache).toHaveBeenCalledWith("prompt:create-chat:");
  });
});

describe("invalidatePromptCache", () => {
  it("invalidates all labels for the prompt name", async () => {
    await invalidatePromptCache("some-prompt");
    expect(mockInvalidateCache).toHaveBeenCalledWith("prompt:some-prompt:");
  });
});
