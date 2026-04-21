import {beforeEach, describe, expect, it, mock} from "bun:test";

import {LangfuseCache} from "./langfuseCache";
import type {LangfuseCachedPrompt} from "./langfuseTypes";

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

const realLangfuseClient = await import("./langfuseClient");
mock.module("./langfuseClient", () => ({
  ...realLangfuseClient,
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

beforeEach(async () => {
  await LangfuseCache.deleteMany({});
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
    await LangfuseCache.create({
      expiresAt: new Date(Date.now() + 60_000),
      key: "prompt:test-prompt:production",
      value: textPrompt,
    });

    const result = await getPrompt("test-prompt");

    expect(result.name).toBe(textPrompt.name);
    expect(result.prompt).toBe(textPrompt.prompt);
    expect(result.version).toBe(textPrompt.version);
    expect(mockPromptGet).toHaveBeenCalledTimes(0);
  });

  it("fetches and caches prompts with default ttl/label", async () => {
    const result = await getPrompt("test-prompt");

    expect(mockPromptGet).toHaveBeenCalledWith("test-prompt", {
      cacheTtlSeconds: 0,
      label: "production",
    });
    const cached = await LangfuseCache.findOne({key: "prompt:test-prompt:production"});
    expect(cached?.value).toEqual(result as any);
  });

  it("fetches and caches prompts with custom ttl/label", async () => {
    await getPrompt("test-prompt", {label: "staging"}, {cache: {promptTtlSeconds: 120}});

    expect(mockPromptGet).toHaveBeenCalledWith("test-prompt", {
      cacheTtlSeconds: 0,
      label: "staging",
    });
    const cached = await LangfuseCache.findOne({key: "prompt:test-prompt:staging"});
    expect(cached).toBeTruthy();
    const expectedExpiryMs = Date.now() + 120_000;
    // Allow some slack for test execution time
    expect(cached!.expiresAt.getTime()).toBeGreaterThan(expectedExpiryMs - 5000);
    expect(cached!.expiresAt.getTime()).toBeLessThan(expectedExpiryMs + 5000);
  });

  it("throws when Langfuse fetch fails", async () => {
    mockPromptGet.mockImplementation(async () => {
      throw new Error("boom");
    });
    await expect(getPrompt("test-prompt")).rejects.toThrow("boom");
  });
});

describe("createPrompt", () => {
  it("creates text prompts with default labels/tags", async () => {
    await createPrompt({name: "new-prompt", prompt: "Hello", type: "text"});
    expect(mockPromptCreate).toHaveBeenCalled();
    const call = (mockPromptCreate.mock.calls[0] as any[])[0];
    expect(call.name).toBe("new-prompt");
    expect(call.type).toBe("text");
  });

  it("creates chat prompts preserving role and content", async () => {
    await createPrompt({
      name: "chat-new",
      prompt: [{content: "hi", role: "user"}],
      tags: ["x"],
      type: "chat",
    });
    expect(mockPromptCreate).toHaveBeenCalled();
    const call = (mockPromptCreate.mock.calls[0] as any[])[0];
    expect(call.type).toBe("chat");
    expect(Array.isArray(call.prompt)).toBe(true);
    expect(call.tags).toEqual(["x"]);
  });
});

describe("invalidatePromptCache", () => {
  it("invalidates cache entries for a prompt prefix", async () => {
    await LangfuseCache.create({
      expiresAt: new Date(Date.now() + 60_000),
      key: "prompt:my-prompt:production",
      value: textPrompt,
    });
    await LangfuseCache.create({
      expiresAt: new Date(Date.now() + 60_000),
      key: "prompt:my-prompt:staging",
      value: textPrompt,
    });
    await LangfuseCache.create({
      expiresAt: new Date(Date.now() + 60_000),
      key: "prompt:other-prompt:production",
      value: textPrompt,
    });

    await invalidatePromptCache("my-prompt");

    const remaining = await LangfuseCache.find({});
    const keys = remaining.map((r) => r.key);
    expect(keys).toContain("prompt:other-prompt:production");
    expect(keys).not.toContain("prompt:my-prompt:production");
    expect(keys).not.toContain("prompt:my-prompt:staging");
  });
});
