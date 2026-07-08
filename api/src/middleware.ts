import * as Sentry from "@sentry/bun";
import type {NextFunction, Request, Response} from "express";

import {APIError} from "./errors";
import {getCurrentRequestContext} from "./requestContext";

/**
 * Express middleware that rejects the request with a 403 unless the authenticated user is an admin
 * (`req.user.admin === true`). Run it after {@link authenticateMiddleware} so `req.user` is
 * populated, e.g. `[authenticateMiddleware(), requireAdminMiddleware]`. Use this for admin-only
 * custom routes instead of hand-rolling an inline admin guard.
 */
export const requireAdminMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const user = req.user as {admin?: boolean} | undefined;
  if (!user?.admin) {
    throw new APIError({status: 403, title: "Admin access required"});
  }
  next();
};

/**
 * Express middleware that captures the app version from the request header
 * and adds it as a tag to the current Sentry scope.
 *
 * This allows filtering Sentry errors by app version.
 *
 * Expected header: `App-Version`
 */
export const sentryAppVersionMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const appVersion = req.get("App-Version");
  if (appVersion) {
    Sentry.getCurrentScope().setTag("app_version", appVersion);
  }
  next();
};

/**
 * OpenAPI vendor routes that must return pristine JSON (no injected requestId).
 * Matches @wesleytodd/openapi: main spec, per-component JSON, and validate payload.
 */
const isOpenApiToolingJsonRequest = (req: Request): boolean => {
  if (req.method !== "GET") {
    return false;
  }
  const {path} = req;
  if (path === "/openapi.json") {
    return true;
  }
  if (path === "/openapi/validate") {
    return true;
  }
  if (path.startsWith("/openapi/components/") && path.endsWith(".json")) {
    return true;
  }
  return false;
};

/**
 * TerrenoApp middleware: augments `res.json` so plain-object payloads include
 * `requestId` for client correlation. Skips OpenAPI tooling GET JSON routes
 * (`/openapi.json`, `/openapi/components/...json`, `/openapi/validate`) so
 * machine-consumed payloads stay valid. Does not wrap arrays or primitives.
 */
export const jsonResponseRequestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const originalJson = res.json.bind(res);
  res.json = (body?: unknown): Response => {
    if (isOpenApiToolingJsonRequest(req)) {
      return originalJson(body);
    }

    const requestId =
      (req as Request & {requestId?: string}).requestId ?? getCurrentRequestContext()?.requestId;

    if (!requestId) {
      return originalJson(body);
    }

    if (body !== null && body !== undefined && typeof body === "object" && !Array.isArray(body)) {
      return originalJson({...(body as Record<string, unknown>), requestId});
    }

    return originalJson(body);
  };

  next();
};
