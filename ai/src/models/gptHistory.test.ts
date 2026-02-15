import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import mongoose from "mongoose";

import {GptHistory} from "./gptHistory";

describe("GptHistory Model", () => {
  beforeEach(async () => {
    await GptHistory.deleteMany({});
  });

  afterEach(async () => {
    await GptHistory.deleteMany({});
  });

  describe("schema", () => {
    it("should create a history with required fields", async () => {
      const userId = new mongoose.Types.ObjectId();
      const history = await GptHistory.create({
        prompts: [],
        userId,
      });

      expect(history.userId.toString()).toBe(userId.toString());
      expect(history.prompts).toEqual([]);
      expect(history.created).toBeDefined();
      expect(history.updated).toBeDefined();
      expect(history.deleted).toBe(false);
    });

    it("should create a history with prompts", async () => {
      const userId = new mongoose.Types.ObjectId();
      const history = await GptHistory.create({
        prompts: [
          {text: "Hello", type: "user"},
          {model: "gpt-4", text: "Hi there!", type: "assistant"},
        ],
        userId,
      });

      expect(history.prompts.length).toBe(2);
      expect(history.prompts[0].text).toBe("Hello");
      expect(history.prompts[0].type).toBe("user");
      expect(history.prompts[1].text).toBe("Hi there!");
      expect(history.prompts[1].type).toBe("assistant");
      expect(history.prompts[1].model).toBe("gpt-4");
    });

    it("should require userId", async () => {
      await expect(GptHistory.create({prompts: []})).rejects.toThrow();
    });
  });

  describe("auto-title", () => {
    it("should auto-generate title from first assistant response", async () => {
      const userId = new mongoose.Types.ObjectId();
      const history = new GptHistory({
        prompts: [
          {text: "What is AI?", type: "user"},
          {
            text: "Artificial Intelligence is a branch of computer science that aims to create intelligent machines.",
            type: "assistant",
          },
        ],
        userId,
      });

      await history.save();

      expect(history.title).toBe("Artificial Intelligence is a branch of computer sc");
    });

    it("should not overwrite existing title", async () => {
      const userId = new mongoose.Types.ObjectId();
      const history = new GptHistory({
        prompts: [{text: "Some response", type: "assistant"}],
        title: "Custom Title",
        userId,
      });

      await history.save();

      expect(history.title).toBe("Custom Title");
    });

    it("should not set title if no assistant response", async () => {
      const userId = new mongoose.Types.ObjectId();
      const history = new GptHistory({
        prompts: [{text: "Hello", type: "user"}],
        userId,
      });

      await history.save();

      expect(history.title).toBeUndefined();
    });
  });

  describe("soft delete", () => {
    it("should filter out deleted records by default", async () => {
      const userId = new mongoose.Types.ObjectId();
      await GptHistory.create({deleted: true, prompts: [], userId});
      await GptHistory.create({prompts: [], userId});

      const results = await GptHistory.find({});
      expect(results.length).toBe(1);
    });
  });
});
