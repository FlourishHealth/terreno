import {describe, expect, it, mock} from "bun:test";

import {getCached, invalidateCache, LangfuseCache, setCached} from "./langfuseCache";
import type {LangfuseCachedPrompt} from "./langfuseTypes";

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
  describe("getCached", () => {
    it("returns null when no entry exists", async () => {
      const lean = mock(async () => null);
      const findOne = mock(() => ({lean}));
      LangfuseCache.findOne = findOne as unknown as typeof LangfuseCache.findOne;

      const result = await getCached("prompt:missing:production");

      expect(result).toBeNull();
      expect(findOne).toHaveBeenCalledTimes(1);
      const [query] = (findOne as {mock: {calls: unknown[][]}}).mock.calls[0];
      expect((query as {key: string}).key).toBe("prompt:missing:production");
      expect((query as {expiresAt: {$gt: Date}}).expiresAt.$gt).toBeInstanceOf(Date);
    });

    it("returns cached value when entry exists", async () => {
      const lean = mock(async () => ({value: samplePrompt}));
      const findOne = mock(() => ({lean}));
      LangfuseCache.findOne = findOne as unknown as typeof LangfuseCache.findOne;

      const result = await getCached("prompt:test:production");

      expect(result).toEqual(samplePrompt);
      expect(lean).toHaveBeenCalledTimes(1);
    });
  });

  describe("setCached", () => {
    it("upserts cache entries with computed expiry", async () => {
      const findOneAndUpdate = mock(async () => ({}));
      LangfuseCache.findOneAndUpdate =
        findOneAndUpdate as unknown as typeof LangfuseCache.findOneAndUpdate;

      const beforeCall = Date.now();
      await setCached("prompt:test:production", samplePrompt, 60);
      const afterCall = Date.now();

      expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
      const [filter, update, options] = (findOneAndUpdate as {mock: {calls: unknown[][]}}).mock.calls[0];
      expect(filter).toEqual({key: "prompt:test:production"});
      expect((update as {key: string}).key).toBe("prompt:test:production");
      expect((update as {value: LangfuseCachedPrompt}).value).toEqual(samplePrompt);
      expect(options).toEqual({upsert: true});

      const expiresAt = (update as {expiresAt: Date}).expiresAt.getTime();
      expect(expiresAt).toBeGreaterThanOrEqual(beforeCall + 59000);
      expect(expiresAt).toBeLessThanOrEqual(afterCall + 61000);
    });
  });

  describe("invalidateCache", () => {
    it("passes regex key pattern to deleteMany", async () => {
      const deleteMany = mock(async () => ({}));
      LangfuseCache.deleteMany = deleteMany as unknown as typeof LangfuseCache.deleteMany;

      await invalidateCache("prompt:test-prompt:");

      expect(deleteMany).toHaveBeenCalledTimes(1);
      expect(deleteMany).toHaveBeenCalledWith({key: {$regex: "prompt:test-prompt:"}});
    });
  });
});
