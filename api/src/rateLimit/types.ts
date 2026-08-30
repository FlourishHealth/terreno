import type {Request} from "express";

/** Default fixed window: 15 minutes. */
export const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

/** Stricter bucket for login, signup, refresh, OTP, GitHub OAuth, Better Auth sign-in. */
export const DEFAULT_AUTH_MAX = 20;

/** Looser bucket for modelRouter and other framework HTTP. */
export const DEFAULT_API_MAX = 600;

export interface RateLimitLimits {
  windowMs?: number;
  authMax?: number;
  apiMax?: number;
}

export interface RateLimitOptions {
  store?: "memory" | "redis" | "mongo";
  limits?: RateLimitLimits;
  trustProxy?: boolean | number | string | string[];
  skip?: (req: Request) => boolean;
  /**
   * Better Auth `basePath` (default `/api/auth`). Used to classify sign-in routes
   * as the auth bucket.
   */
  betterAuthBasePath?: string;
  /** Test-only clock. */
  now?: () => number;
  /**
   * Test-only store override. Production uses `store`.
   */
  storeImpl?: RateLimitStore;
  /**
   * Test-only Redis client. Production Redis store builds a client from VALKEY_URL / REDIS_URL.
   */
  redisClient?: RateLimitRedisClient;
}

export interface RateLimitConsumeArgs {
  key: string;
  max: number;
  windowMs: number;
  now: number;
}

export interface RateLimitConsumeResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimitStore {
  consume: (args: RateLimitConsumeArgs) => Promise<RateLimitConsumeResult>;
}

export interface RateLimitRedisClient {
  incr: (key: string) => Promise<number>;
  pExpire: (key: string, milliseconds: number) => Promise<unknown>;
  pTTL: (key: string) => Promise<number>;
}

export type RateLimitPolicyName = "auth" | "api";
