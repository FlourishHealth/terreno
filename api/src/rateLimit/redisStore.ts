import {APIError} from "../errors";
import type {
  RateLimitConsumeArgs,
  RateLimitConsumeResult,
  RateLimitOptions,
  RateLimitRedisClient,
  RateLimitStore,
} from "./types";

export const redisUrlFromEnv = (): string | undefined => {
  return process.env.VALKEY_URL || process.env.REDIS_URL;
};

interface IoredisClient {
  incr: (key: string) => Promise<number>;
  pexpire: (key: string, milliseconds: number) => Promise<number>;
  pttl: (key: string) => Promise<number>;
}

interface IoredisModule {
  default: new (url: string) => IoredisClient;
}

const connectIoredis = async (url: string): Promise<RateLimitRedisClient> => {
  const loaded = (await import("ioredis").catch(() => null)) as IoredisModule | null;
  if (!loaded?.default) {
    throw new APIError({
      status: 500,
      title: "Redis rate limit store requires the ioredis package",
    });
  }
  const Redis = loaded.default;
  const client = new Redis(url);
  return {
    incr: (key: string) => client.incr(key),
    pExpire: (key: string, milliseconds: number) => client.pexpire(key, milliseconds),
    pTTL: (key: string) => client.pttl(key),
  };
};

export const createRedisRateLimitStore = (options: RateLimitOptions = {}): RateLimitStore => {
  const url = redisUrlFromEnv();
  if (!options.redisClient && !url) {
    throw new APIError({
      status: 500,
      title: "Redis rate limit store requires VALKEY_URL or REDIS_URL",
    });
  }

  let clientPromise: Promise<RateLimitRedisClient> | undefined;

  const getClient = (): Promise<RateLimitRedisClient> => {
    if (options.redisClient) {
      return Promise.resolve(options.redisClient);
    }
    if (!clientPromise) {
      clientPromise = connectIoredis(url as string);
    }
    return clientPromise;
  };

  const consume = async ({
    key,
    max,
    windowMs,
    now,
  }: RateLimitConsumeArgs): Promise<RateLimitConsumeResult> => {
    const client = await getClient();
    const redisKey = `terreno:rate-limit:${key}`;
    const count = await client.incr(redisKey);
    if (count === 1) {
      await client.pExpire(redisKey, windowMs);
    }
    let ttl = await client.pTTL(redisKey);
    if (ttl < 0) {
      await client.pExpire(redisKey, windowMs);
      ttl = windowMs;
    }
    const resetAt = now + ttl;
    const allowed = count <= max;
    return {allowed, remaining: Math.max(0, max - count), resetAt};
  };

  return {consume};
};
