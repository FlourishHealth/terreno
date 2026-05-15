import {beforeEach, describe, expect, it} from "bun:test";

import {getCached, invalidateCache, LangfuseCache, setCached} from "./langfuseCache";

describe("langfuseCache", () => {
  beforeEach(async () => {
    await LangfuseCache.deleteMany({});
  });

  it("returns null for missing keys", async () => {
    expect(await getCached("missing")).toBeNull();
  });

  it("stores and retrieves a cached prompt", async () => {
    await setCached(
      "prompt:hello:production",
      {
        config: {},
        labels: [],
        name: "hello",
        prompt: "Hi",
        tags: [],
        type: "text",
        version: 1,
      },
      60
    );
    const got = await getCached("prompt:hello:production");
    expect(got?.name).toBe("hello");
  });

  it("upserts existing entries via setCached", async () => {
    await setCached(
      "prompt:x:production",
      {config: {}, labels: [], name: "x", prompt: "old", tags: [], type: "text", version: 1},
      60
    );
    await setCached(
      "prompt:x:production",
      {config: {}, labels: [], name: "x", prompt: "new", tags: [], type: "text", version: 2},
      60
    );
    const got = await getCached("prompt:x:production");
    expect(got?.version).toBe(2);
  });

  it("returns null for expired entries", async () => {
    await setCached(
      "prompt:expired:production",
      {config: {}, labels: [], name: "expired", prompt: "", tags: [], type: "text", version: 1},
      60
    );
    await LangfuseCache.updateOne(
      {key: "prompt:expired:production"},
      {expiresAt: new Date(Date.now() - 1000)}
    );
    expect(await getCached("prompt:expired:production")).toBeNull();
  });

  it("invalidates entries matching a pattern", async () => {
    await setCached(
      "prompt:keep:production",
      {config: {}, labels: [], name: "keep", prompt: "", tags: [], type: "text", version: 1},
      60
    );
    await setCached(
      "prompt:drop:production",
      {config: {}, labels: [], name: "drop", prompt: "", tags: [], type: "text", version: 1},
      60
    );
    await invalidateCache("prompt:drop");
    expect(await getCached("prompt:drop:production")).toBeNull();
    expect(await getCached("prompt:keep:production")).not.toBeNull();
  });
});
