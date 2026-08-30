import {APIError} from "../errors";
import {createMemoryRateLimitStore} from "./memoryStore";
import {createRedisRateLimitStore} from "./redisStore";
import type {RateLimitOptions, RateLimitStore} from "./types";

export const createRateLimitStore = (options: RateLimitOptions): RateLimitStore => {
  if (options.storeImpl) {
    return options.storeImpl;
  }
  const kind = options.store ?? "memory";
  if (kind === "memory") {
    return createMemoryRateLimitStore();
  }
  if (kind === "redis") {
    return createRedisRateLimitStore(options);
  }
  throw new APIError({
    status: 500,
    title: `Unknown rate limit store: ${String(kind)}`,
  });
};
