import type {RateLimitConsumeArgs, RateLimitConsumeResult, RateLimitStore} from "./types";

interface MemoryWindow {
  count: number;
  resetAt: number;
}

export const createMemoryRateLimitStore = (): RateLimitStore => {
  const windows = new Map<string, MemoryWindow>();

  const consume = async ({
    key,
    max,
    windowMs,
    now,
  }: RateLimitConsumeArgs): Promise<RateLimitConsumeResult> => {
    const existing = windows.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs;
      windows.set(key, {count: 1, resetAt});
      return {allowed: true, remaining: Math.max(0, max - 1), resetAt};
    }
    existing.count += 1;
    const allowed = existing.count <= max;
    return {
      allowed,
      remaining: Math.max(0, max - existing.count),
      resetAt: existing.resetAt,
    };
  };

  return {consume};
};
