import {describe, expect, it, mock} from "bun:test";

const realLangfusePrompts = await import("./langfusePrompts");

const getPromptMock = mock(
  async (name: string, _options?: any, _appOptions?: any): Promise<any> => ({
    config: {temperature: 0.5},
    labels: [],
    name,
    prompt: "Hi {{name}}",
    tags: [],
    type: "text" as const,
    version: 3,
  })
);

// Spread the real module so that other tests loaded later (e.g. langfusePrompts.test.ts)
// still see the real `createPrompt`, `invalidatePromptCache`, etc. through the module cache.
mock.module("./langfusePrompts", () => ({
  ...realLangfusePrompts,
  compilePrompt: (cached: any, variables: Record<string, string> = {}) => {
    if (cached.type === "text") {
      return (cached.prompt as string).replace(/\{\{(\w+)\}\}/g, (_m, k) => variables[k] ?? "");
    }
    return (cached.prompt as Array<{content: string; role: string}>).map((m) => ({
      content: m.content,
      role: m.role,
    }));
  },
  getPrompt: getPromptMock,
}));

const {createTelemetryConfig, preparePromptForAI} = await import("./langfuseVercelAi");

describe("langfuseVercelAi", () => {
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
      getPromptMock.mockImplementationOnce(async (name: string) => ({
        config: {},
        labels: [],
        name,
        prompt: [{content: "Hello", role: "user"}],
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
