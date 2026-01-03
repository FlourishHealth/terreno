import * as Sentry from "@sentry/node";
import type {NextFunction, Request, Response} from "express";

/**
 * Express middleware that captures the app version from the request header
 * and adds it as a tag to the current Sentry scope.
 *
 * This allows filtering Sentry errors by app version.
 *
 * Expected header: `App-Version`
 */
export function sentryAppVersionMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const appVersion = req.get("App-Version");
  if (appVersion) {
    Sentry.getCurrentScope().setTag("app_version", appVersion);
  }
  next();
}
