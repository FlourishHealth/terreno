import {beforeEach, describe, expect, it, mock} from "bun:test";

import {LangfuseCache} from "./langfuseCache";

const mockPromptGet = mock(async (_name: string, _options?: Record<string, unknown>) => ({
  config: {temperature: 0.5},
  labels: [],
  name: "welcome",
  prompt: "Hi {{name}}",
  tags: [],
  type: "text" as const,
  version: 3,
}));

// Mock the langfuse SDK client so the real `getPrompt`/`compilePrompt` from
// `./langfusePrompts` can be exercised without network access. We intentionally
// do NOT mock `./langfusePrompts` directly because that would leak into other
// test suites that share the module cache in the same bun process.
const realLangfuseClient = await import("./langfuseClient");
mock.module("./langfuseClient", () => ({
  ...realLangfuseClient,
  getLangfuseClient: () => ({prompt: {get: mockPromptGet}}),
}));

const {createTelemetryConfig, preparePromptForAI} = await import("./langfuseVercelAi");

describe("langfuseVercelAi", () => {
  beforeEach(async () => {
    mockPromptGet.mockClear();
    await LangfuseCache.deleteMany({});
  });

  describe("preparePromptForAI", () => {
    it("returns a compiled text prompt with telemetry", async () => {
      const result = await preparePromptForAI({
        promptName: "welcome",
        userId: "user-1",
        variables: {name: "Sam"},
      });
      expect(result.prompt).toBe("Hi Sam");
      expect(result.telemetry.functionId).toBe("prompt:welcome");
      expect(result.telemetry.metadata?.userId).toBe("user-1");
      expect(result.telemetry.metadata?.langfusePromptVersion).toBe(3);
    });

    it("omits userId metadata when not provided", async () => {
      const result = await preparePromptForAI({promptName: "welcome"});
      expect(result.telemetry.metadata?.userId).toBeUndefined();
    });

    it("returns chat messages for chat prompts", async () => {
      mockPromptGet.mockImplementationOnce(async (name: string) => ({
        config: {},
        labels: [],
        name,
        prompt: [{content: "Hello", role: "user" as const}],
        tags: [],
        type: "chat" as const,
        version: 1,
      }));
      const result = await preparePromptForAI({promptName: "chat"});
      expect(result.messages).toEqual([{content: "Hello", role: "user"}]);
    });
  });

  describe("createTelemetryConfig", () => {
    it("builds a telemetry config with userId and metadata", () => {
      const t = createTelemetryConfig({
        functionId: "fn-1",
        metadata: {foo: "bar"},
        userId: "user-1",
      });
      expect(t.functionId).toBe("fn-1");
      expect(t.isEnabled).toBe(true);
      expect(t.metadata).toEqual({foo: "bar", userId: "user-1"});
    });

    it("omits userId when not provided", () => {
      const t = createTelemetryConfig({functionId: "fn-2"});
      expect(t.metadata).toEqual({});
    });
  });
});
