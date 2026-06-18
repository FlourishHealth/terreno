import * as Sentry from "@sentry/bun";
import type {NextFunction, Request, Response} from "express";

import {getCurrentRequestContext} from "./requestContext";

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

const isOpenApiJsonRequest = (req: Request): boolean => {
  return req.method === "GET" && req.path === "/openapi.json";
};

/**
 * TerrenoApp middleware: augments `res.json` so plain-object payloads include
 * `requestId` for client correlation. Skips GET `/openapi.json` so the spec
 * document stays valid OpenAPI. Does not wrap arrays or primitives.
 */
export const jsonResponseRequestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const originalJson = res.json.bind(res);
  res.json = (body?: unknown): Response => {
    if (isOpenApiJsonRequest(req)) {
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
