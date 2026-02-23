import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import mongoose from "mongoose";

import {AIRequest} from "./aiRequest";

describe("AIRequest Model", () => {
  beforeEach(async () => {
    await AIRequest.deleteMany({});
  });

  afterEach(async () => {
    await AIRequest.deleteMany({});
  });

  describe("schema", () => {
    it("should create an AI request with required fields", async () => {
      const request = await AIRequest.create({
        aiModel: "gpt-4",
        prompt: "Hello",
        requestType: "general",
      });

      expect(request.aiModel).toBe("gpt-4");
      expect(request.prompt).toBe("Hello");
      expect(request.requestType).toBe("general");
      expect(request.created).toBeDefined();
      expect(request.updated).toBeDefined();
      expect(request.deleted).toBe(false);
    });

    it("should create a request with all fields", async () => {
      const userId = new mongoose.Types.ObjectId();
      const request = await AIRequest.create({
        aiModel: "gemini-2.5-flash",
        error: undefined,
        metadata: {key: "value"},
        prompt: "Translate this",
        requestType: "translation",
        response: "Translated text",
        responseTime: 1500,
        tokensUsed: 100,
        userId,
      });

      expect(request.aiModel).toBe("gemini-2.5-flash");
      expect(request.requestType).toBe("translation");
      expect(request.response).toBe("Translated text");
      expect(request.responseTime).toBe(1500);
      expect(request.tokensUsed).toBe(100);
      expect(request.userId?.toString()).toBe(userId.toString());
      expect(request.metadata).toEqual({key: "value"});
    });

    it("should reject invalid request types", async () => {
      await expect(
        AIRequest.create({
          aiModel: "gpt-4",
          prompt: "test",
          requestType: "invalid" as any,
        })
      ).rejects.toThrow();
    });
  });

  describe("logRequest static", () => {
    it("should create a request via logRequest", async () => {
      const request = await AIRequest.logRequest({
        aiModel: "gpt-4",
        prompt: "test prompt",
        requestType: "general",
        response: "test response",
        responseTime: 500,
        tokensUsed: 50,
      });

      expect(request._id).toBeDefined();
      expect(request.prompt).toBe("test prompt");
      expect(request.response).toBe("test response");
    });
  });

  describe("soft delete", () => {
    it("should filter out deleted records by default", async () => {
      await AIRequest.create({
        aiModel: "gpt-4",
        deleted: true,
        prompt: "deleted",
        requestType: "general",
      });
      await AIRequest.create({
        aiModel: "gpt-4",
        prompt: "active",
        requestType: "general",
      });

      const results = await AIRequest.find({});
      expect(results.length).toBe(1);
      expect(results[0].prompt).toBe("active");
    });
  });
});
