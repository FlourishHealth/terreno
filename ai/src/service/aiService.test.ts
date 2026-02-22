import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import mongoose from "mongoose";

import {AIRequest} from "../models/aiRequest";
import {AIService, TemperaturePresets} from "./aiService";

// Create a mock LanguageModel
const createMockModel = (responseText = "Mock response") => {
  return {
    doGenerate: mock(async () => ({
      finishReason: "stop" as const,
      rawCall: {rawPrompt: "", rawSettings: {}},
      text: responseText,
      usage: {completionTokens: 10, promptTokens: 5},
    })),
    doStream: mock(async () => ({
      rawCall: {rawPrompt: "", rawSettings: {}},
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({
            finishReason: undefined,
            textDelta: "Mock ",
            type: "text-delta" as const,
          });
          controller.enqueue({
            finishReason: undefined,
            textDelta: "response",
            type: "text-delta" as const,
          });
          controller.enqueue({
            finishReason: "stop" as const,
            logprobs: undefined,
            type: "finish" as const,
            usage: {completionTokens: 10, promptTokens: 5},
          });
          controller.close();
        },
      }),
    })),
    modelId: "mock-model",
    provider: "mock-provider",
    specificationVersion: "v1" as const,
  };
};

describe("AIService", () => {
  beforeEach(async () => {
    await AIRequest.deleteMany({});
  });

  afterEach(async () => {
    await AIRequest.deleteMany({});
  });

  describe("constructor", () => {
    it("should create an instance with default temperature", () => {
      const model = createMockModel();
      const service = new AIService({model: model as any});
      expect(service).toBeDefined();
    });

    it("should create an instance with custom temperature", () => {
      const model = createMockModel();
      const service = new AIService({
        defaultTemperature: TemperaturePresets.LOW,
        model: model as any,
      });
      expect(service).toBeDefined();
    });
  });

  describe("generateText", () => {
    it("should generate text and log the request", async () => {
      const model = createMockModel("Hello world");
      const service = new AIService({model: model as any});
      const userId = new mongoose.Types.ObjectId();

      const result = await service.generateText({
        prompt: "Say hello",
        userId,
      });

      expect(result).toBe("Hello world");

      // Verify request was logged
      const logs = await AIRequest.find({userId});
      expect(logs.length).toBe(1);
      expect(logs[0].prompt).toBe("Say hello");
      expect(logs[0].response).toBe("Hello world");
      expect(logs[0].aiModel).toBe("mock-model");
      expect(logs[0].requestType).toBe("general");
    });

    it("should log errors on failure", async () => {
      const model = createMockModel();
      model.doGenerate = mock(async () => {
        throw new Error("API error");
      });
      const service = new AIService({model: model as any});

      await expect(service.generateText({prompt: "test"})).rejects.toThrow("API error");

      const logs = await AIRequest.find({});
      expect(logs.length).toBe(1);
      expect(logs[0].error).toBe("API error");
    });
  });

  describe("generateTextStream", () => {
    it("should stream text chunks", async () => {
      const model = createMockModel();
      const service = new AIService({model: model as any});

      const chunks: string[] = [];
      for await (const chunk of service.generateTextStream({prompt: "test"})) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join("")).toBe("Mock response");
    });
  });

  describe("generateRemix", () => {
    it("should remix text", async () => {
      const model = createMockModel("Remixed text");
      const service = new AIService({model: model as any});

      const result = await service.generateRemix({text: "Original text"});
      expect(result).toBe("Remixed text");
    });
  });

  describe("generateSummary", () => {
    it("should summarize text", async () => {
      const model = createMockModel("Summary of the text");
      const service = new AIService({model: model as any});

      const result = await service.generateSummary({text: "Long text to summarize"});
      expect(result).toBe("Summary of the text");
    });
  });

  describe("translateText", () => {
    it("should translate text", async () => {
      const model = createMockModel("Hola mundo");
      const service = new AIService({model: model as any});

      const result = await service.translateText({
        targetLanguage: "Spanish",
        text: "Hello world",
      });
      expect(result).toBe("Hola mundo");
    });
  });

  describe("buildMessages", () => {
    it("should convert simple text prompts to CoreMessages", () => {
      const model = createMockModel();
      const service = new AIService({model: model as any});

      const messages = service.buildMessages([
        {text: "Hello", type: "user"},
        {text: "Hi there!", type: "assistant"},
        {text: "How are you?", type: "user"},
      ]);

      expect(messages.length).toBe(3);
      expect(messages[0]).toEqual({content: "Hello", role: "user"});
      expect(messages[1]).toEqual({content: "Hi there!", role: "assistant"});
      expect(messages[2]).toEqual({content: "How are you?", role: "user"});
    });

    it("should convert multi-modal user prompts with image content", () => {
      const model = createMockModel();
      const service = new AIService({model: model as any});

      const messages = service.buildMessages([
        {
          content: [
            {text: "What is this?", type: "text" as const},
            {mimeType: "image/jpeg", type: "image" as const, url: "https://example.com/img.jpg"},
          ],
          text: "What is this?",
          type: "user",
        },
      ]);

      expect(messages.length).toBe(1);
      expect(messages[0].role).toBe("user");
      const content = (messages[0] as any).content;
      expect(content.length).toBe(2);
      expect(content[0].type).toBe("text");
      expect(content[0].text).toBe("What is this?");
      expect(content[1].type).toBe("image");
    });

    it("should skip tool-call and tool-result prompts", () => {
      const model = createMockModel();
      const service = new AIService({model: model as any});

      const messages = service.buildMessages([
        {text: "What time is it?", type: "user"},
        {
          args: {},
          text: "Tool call: get_time",
          toolCallId: "c1",
          toolName: "get_time",
          type: "tool-call",
        },
        {
          result: "12:00",
          text: "Tool result: get_time",
          toolCallId: "c1",
          toolName: "get_time",
          type: "tool-result",
        },
        {text: "The time is 12:00", type: "assistant"},
      ]);

      expect(messages.length).toBe(2);
      expect(messages[0]).toEqual({content: "What time is it?", role: "user"});
      expect(messages[1]).toEqual({content: "The time is 12:00", role: "assistant"});
    });

    it("should handle system messages", () => {
      const model = createMockModel();
      const service = new AIService({model: model as any});

      const messages = service.buildMessages([
        {text: "You are helpful", type: "system"},
        {text: "Hello", type: "user"},
      ]);

      expect(messages.length).toBe(2);
      expect(messages[0]).toEqual({content: "You are helpful", role: "system"});
    });
  });

  describe("TemperaturePresets", () => {
    it("should have correct values", () => {
      expect(TemperaturePresets.DETERMINISTIC).toBe(0);
      expect(TemperaturePresets.LOW).toBe(0.3);
      expect(TemperaturePresets.BALANCED).toBe(0.7);
      expect(TemperaturePresets.DEFAULT).toBe(1.0);
      expect(TemperaturePresets.HIGH).toBe(1.5);
      expect(TemperaturePresets.MAXIMUM).toBe(2.0);
    });
  });
});
