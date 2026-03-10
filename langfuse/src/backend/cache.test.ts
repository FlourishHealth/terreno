import {afterEach, beforeEach, describe, expect, it} from "bun:test";

import {getCached, invalidateCache, LangfuseCache, setCached} from "./cache";
import type {LangfuseCachedPrompt} from "./types";

const samplePrompt: LangfuseCachedPrompt = {
  config: {},
  labels: ["production"],
  name: "test-prompt",
  prompt: "Hello world",
  tags: [],
  type: "text",
  version: 1,
};

describe("cache", () => {
  beforeEach(async () => {
    await LangfuseCache.deleteMany({});
  });

  afterEach(async () => {
    await LangfuseCache.deleteMany({});
  });

  describe("getCached", () => {
    it("returns null when no entry exists", async () => {
      const result = await getCached("prompt:missing:production");
      expect(result).toBeNull();
    });

    it("returns null for expired entries", async () => {
      await setCached("prompt:test:production", samplePrompt, -1);
      const result = await getCached("prompt:test:production");
      expect(result).toBeNull();
    });

    it("returns the value for valid non-expired entries", async () => {
      await setCached("prompt:test:production", samplePrompt, 60);
      const result = await getCached("prompt:test:production");
      expect(result).not.toBeNull();
      expect(result?.name).toBe("test-prompt");
      expect(result?.type).toBe("text");
    });
  });

  describe("setCached", () => {
    it("stores a new entry", async () => {
      await setCached("prompt:test:production", samplePrompt, 60);
      const count = await LangfuseCache.countDocuments({key: "prompt:test:production"});
      expect(count).toBe(1);
    });

    it("upserts when the same key is set twice", async () => {
      await setCached("prompt:test:production", samplePrompt, 60);
      const updated: LangfuseCachedPrompt = {...samplePrompt, version: 2};
      await setCached("prompt:test:production", updated, 60);

      const count = await LangfuseCache.countDocuments({key: "prompt:test:production"});
      expect(count).toBe(1);

      const result = await getCached("prompt:test:production");
      expect(result?.version).toBe(2);
    });
  });

  describe("invalidateCache", () => {
    it("removes entries matching the pattern", async () => {
      await setCached("prompt:test-prompt:production", samplePrompt, 60);
      await setCached("prompt:test-prompt:staging", {...samplePrompt, version: 2}, 60);
      await setCached("prompt:other-prompt:production", {...samplePrompt, name: "other"}, 60);

      await invalidateCache("prompt:test-prompt:");

      const remaining = await LangfuseCache.find({}).lean();
      expect(remaining.length).toBe(1);
      expect(remaining[0].key).toBe("prompt:other-prompt:production");
    });

    it("does not throw when no entries match", async () => {
      await expect(invalidateCache("prompt:nonexistent:")).resolves.toBeUndefined();
    });
  });
});
