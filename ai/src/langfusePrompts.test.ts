import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";

import {LangfuseCache} from "./langfuseCache";
import type {LangfuseCachedPrompt} from "./langfuseTypes";

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
  getLangfuseClient: () => ({prompt: {get: mockPromptGet}}),
}));

const {compilePrompt, getPrompt} = await import("./langfusePrompts");

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
    await LangfuseCache.deleteMany({});
    mockPromptGet.mockClear();
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

  afterEach(async () => {
    await LangfuseCache.deleteMany({});
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

  it("writes fetched prompt to cache", async () => {
    await getPrompt("test-prompt");
    const countAfter = await LangfuseCache.countDocuments({key: "prompt:test-prompt:production"});
    expect(countAfter).toBe(1);
  });

  it("throws when Langfuse fetch fails", async () => {
    mockPromptGet.mockImplementation(async () => {
      throw new Error("Prompt not found");
    });

    await expect(getPrompt("missing-prompt")).rejects.toThrow("Prompt not found");
  });
});
