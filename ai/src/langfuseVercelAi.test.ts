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
const mockFetch = mock(async () => new Response(JSON.stringify({successes: []}), {status: 200}));
globalThis.fetch = mockFetch as unknown as typeof fetch;

let mockInitialized = false;
let mockOptions: Record<string, string> | null = null;

const realLangfuseClient = await import("./langfuseClient");
mock.module("./langfuseClient", () => ({
  ...realLangfuseClient,
  getLangfuseClient: () => ({prompt: {get: mockPromptGet}}),
  getLangfuseOptions: () => mockOptions,
  isLangfuseInitialized: () => mockInitialized,
}));

const {createLangfuseTrace, createTelemetryConfig, preparePromptForAI} = await import(
  "./langfuseVercelAi"
);

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

    it("maps Langfuse-specific fields to metadata keys", () => {
      const t = createTelemetryConfig({
        functionId: "fn-3",
        sessionId: "session-123",
        tags: ["chart-review"],
        traceId: "trace-abc",
        updateParent: true,
        userId: "user-1",
      });
      expect(t.metadata).toEqual({
        langfuseSessionId: "session-123",
        langfuseTags: ["chart-review"],
        langfuseTraceId: "trace-abc",
        langfuseUpdateParent: true,
        userId: "user-1",
      });
    });

    it("omits Langfuse metadata keys when not provided", () => {
      const t = createTelemetryConfig({functionId: "fn-4"});
      expect(t.metadata?.langfuseTraceId).toBeUndefined();
      expect(t.metadata?.langfuseSessionId).toBeUndefined();
      expect(t.metadata?.langfuseTags).toBeUndefined();
      expect(t.metadata?.langfuseUpdateParent).toBeUndefined();
    });
  });

  describe("createLangfuseTrace", () => {
    beforeEach(() => {
      mockFetch.mockClear();
      mockInitialized = false;
      mockOptions = null;
    });

    it("returns basic telemetry config when Langfuse is not initialized", async () => {
      mockInitialized = false;
      const t = await createLangfuseTrace({name: "test-trace", userId: "user-1"});
      expect(t.functionId).toBe("test-trace");
      expect(t.isEnabled).toBe(true);
      expect(t.metadata?.userId).toBe("user-1");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("creates a trace via REST API and returns telemetry with traceId", async () => {
      mockInitialized = true;
      mockOptions = {
        baseUrl: "https://langfuse.test",
        publicKey: "pk-test",
        secretKey: "sk-test",
      };

      const t = await createLangfuseTrace({
        input: {notes: "patient notes"},
        name: "chart-review",
        sessionId: "session-456",
        tags: ["chart-review"],
        userId: "user-2",
      });

      expect(t.functionId).toBe("chart-review");
      expect(t.metadata?.langfuseTraceId).toBeDefined();
      expect(t.metadata?.langfuseUpdateParent).toBe(true);
      expect(t.metadata?.langfuseSessionId).toBe("session-456");
      expect(t.metadata?.userId).toBe("user-2");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("https://langfuse.test/api/public/ingestion");
      expect(opts.method).toBe("POST");

      const body = JSON.parse(opts.body as string);
      expect(body.batch).toHaveLength(1);
      expect(body.batch[0].type).toBe("trace-create");
      expect(body.batch[0].body.name).toBe("chart-review");
      expect(body.batch[0].body.input).toEqual({notes: "patient notes"});
      expect(body.batch[0].body.sessionId).toBe("session-456");
      expect(body.batch[0].body.tags).toEqual(["chart-review"]);
    });

    it("falls back gracefully when options are missing", async () => {
      mockInitialized = true;
      mockOptions = null;

      const t = await createLangfuseTrace({name: "fallback-trace"});
      expect(t.functionId).toBe("fallback-trace");
      expect(t.metadata?.langfuseTraceId).toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
