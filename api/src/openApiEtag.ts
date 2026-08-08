import crypto from "node:crypto";
import type {NextFunction, Request, Response} from "express";

/**
 * Middleware to add ETag support for OpenAPI JSON endpoint.
 * This middleware should be added before the @wesleytodd/openapi middleware
 * to intercept requests to /openapi.json and add conditional request support.
 */
export const openApiEtagMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.method !== "GET" || req.path !== "/openapi.json") {
    next();
    return;
  }

  const originalJson = res.json.bind(res);

  res.json = (body: unknown) => {
    const jsonString = JSON.stringify(body);
    const etag = `"${crypto.createHash("sha256").update(jsonString).digest("hex").substring(0, 16)}"`;

    res.set("ETag", etag);

    const ifNoneMatch = req.get("If-None-Match");
    if (ifNoneMatch === etag) {
      res.status(304).end();
      return res;
    }

    return originalJson(body);
  };

  next();
};
