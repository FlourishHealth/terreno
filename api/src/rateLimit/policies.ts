import type {Request} from "express";

import type {RateLimitPolicyName} from "./types";

const DEFAULT_BETTER_AUTH_BASE_PATH = "/api/auth";

const stripQuery = (url: string): string => {
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
};

/** Strip query and a trailing slash so `/auth/login/` matches `/auth/login`. */
export const normalizeRequestPath = (url: string): string => {
  const withoutQuery = stripQuery(url);
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
};

export const requestPath = (req: Request): string => {
  const raw = req.originalUrl || req.url || req.path || "";
  return normalizeRequestPath(raw);
};

const JWT_CREDENTIAL_EXCHANGE_EXACT = new Set([
  "/auth/login",
  "/auth/signup",
  "/auth/refresh_token",
]);

/**
 * JWT login, signup, and refresh must not 401 on a stale access token.
 * `setupAuth` runs before those routes so the client can still exchange credentials.
 */
export const isJwtCredentialExchangePath = (req: Request): boolean => {
  return JWT_CREDENTIAL_EXCHANGE_EXACT.has(requestPath(req));
};

export const shouldSkipRateLimit = (
  req: Request,
  extraSkip?: (req: Request) => boolean
): boolean => {
  const path = requestPath(req);
  if (req.method === "GET" && (path === "/health" || path === "/healthz")) {
    return true;
  }
  if (path === "/openapi.json" || path.startsWith("/openapi.json")) {
    return true;
  }
  if (path === "/swagger" || path.startsWith("/swagger/")) {
    return true;
  }
  if (extraSkip?.(req)) {
    return true;
  }
  return false;
};

const AUTH_EXACT = new Set([
  "/auth/login",
  "/auth/signup",
  "/auth/refresh_token",
  "/auth/github",
  "/auth/github/callback",
  "/auth/github/failure",
]);

const AUTH_PREFIXES = ["/auth/github/"];

const betterAuthAuthPrefixes = (basePath: string): string[] => {
  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  return [
    `${base}/sign-in`,
    `${base}/sign-up`,
    `${base}/forget-password`,
    `${base}/reset-password`,
    `${base}/callback`,
  ];
};

export const classifyRateLimitPolicy = (
  req: Request,
  betterAuthBasePath = DEFAULT_BETTER_AUTH_BASE_PATH
): RateLimitPolicyName => {
  const path = requestPath(req);
  if (AUTH_EXACT.has(path)) {
    return "auth";
  }
  for (const prefix of AUTH_PREFIXES) {
    if (path.startsWith(prefix)) {
      return "auth";
    }
  }
  for (const prefix of betterAuthAuthPrefixes(betterAuthBasePath)) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return "auth";
    }
  }
  return "api";
};

export const rateLimitKey = (req: Request): string => {
  const user = req.user as {_id?: unknown; id?: string} | undefined;
  const userId = user?.id ?? (user?._id != null ? String(user._id) : undefined);
  if (userId) {
    return `user:${userId}`;
  }
  return `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`;
};
