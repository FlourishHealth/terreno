import {describe, it} from "bun:test";
import {assert} from "chai";

import {APIError} from "../errors";
import {createRateLimitStore} from "./createStore";
import {createRedisRateLimitStore, redisUrlFromEnv} from "./redisStore";
import type {RateLimitRedisClient} from "./types";

const createFakeRedis = (): RateLimitRedisClient & {reset: () => void} => {
  const counts = new Map<string, number>();
  const expiresAt = new Map<string, number>();
  const now = (): number => Date.now();

  const isExpired = (key: string): boolean => {
    const exp = expiresAt.get(key);
    return exp !== undefined && exp <= now();
  };

  const client: RateLimitRedisClient & {reset: () => void} = {
    incr: async (key: string): Promise<number> => {
      if (isExpired(key)) {
        counts.delete(key);
        expiresAt.delete(key);
      }
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    },
    pExpire: async (key: string, milliseconds: number): Promise<unknown> => {
      expiresAt.set(key, now() + milliseconds);
      return 1;
    },
    pTTL: async (key: string): Promise<number> => {
      if (!counts.has(key) || isExpired(key)) {
        return -2;
      }
      const exp = expiresAt.get(key);
      if (exp === undefined) {
        return -1;
      }
      return Math.max(0, exp - now());
    },
    reset: (): void => {
      counts.clear();
      expiresAt.clear();
    },
  };
  return client;
};

describe("redis rate limit store", () => {
  it("throws APIError when store is redis and no URL or client is set", () => {
    Reflect.deleteProperty(process.env, "VALKEY_URL");
    Reflect.deleteProperty(process.env, "REDIS_URL");
    try {
      createRedisRateLimitStore();
      assert.fail("expected missing Redis URL to throw");
    } catch (error) {
      assert.instanceOf(error, APIError);
      assert.include(String(error), "VALKEY_URL or REDIS_URL");
    }
    try {
      createRateLimitStore({store: "redis"});
      assert.fail("expected createRateLimitStore redis without URL to throw");
    } catch (error) {
      assert.include(String(error), "VALKEY_URL or REDIS_URL");
    }
  });

  it("prefers VALKEY_URL over REDIS_URL", () => {
    process.env.REDIS_URL = "redis://redis-only";
    process.env.VALKEY_URL = "redis://valkey-wins";
    assert.equal(redisUrlFromEnv(), "redis://valkey-wins");
    Reflect.deleteProperty(process.env, "VALKEY_URL");
    assert.equal(redisUrlFromEnv(), "redis://redis-only");
    Reflect.deleteProperty(process.env, "REDIS_URL");
  });

  it("matches the memory consume contract with an injected client", async () => {
    Reflect.deleteProperty(process.env, "VALKEY_URL");
    Reflect.deleteProperty(process.env, "REDIS_URL");
    const redisClient = createFakeRedis();
    const store = createRateLimitStore({redisClient, store: "redis"});
    const t0 = 2_000_000;
    const a1 = await store.consume({key: "a", max: 2, now: t0, windowMs: 60_000});
    const a2 = await store.consume({key: "a", max: 2, now: t0 + 10, windowMs: 60_000});
    const a3 = await store.consume({key: "a", max: 2, now: t0 + 20, windowMs: 60_000});
    const b1 = await store.consume({key: "b", max: 2, now: t0, windowMs: 60_000});
    assert.isTrue(a1.allowed);
    assert.isTrue(a2.allowed);
    assert.isFalse(a3.allowed);
    assert.isTrue(b1.allowed);
    assert.equal(a3.remaining, 0);
  });

  it("re-sets expiry when Redis reports no TTL", async () => {
    Reflect.deleteProperty(process.env, "VALKEY_URL");
    Reflect.deleteProperty(process.env, "REDIS_URL");
    const redisClient: RateLimitRedisClient = {
      incr: async () => 2,
      pExpire: async () => 1,
      pTTL: async () => -1,
    };
    const store = createRedisRateLimitStore({redisClient});
    const result = await store.consume({
      key: "a",
      max: 5,
      now: 1_000,
      windowMs: 15_000,
    });
    assert.isTrue(result.allowed);
    assert.equal(result.resetAt, 1_000 + 15_000);
  });
});
