import type {Application} from "express";

import type {RateLimitOptions} from "./types";

export const applyRateLimitTrustProxy = (app: Application, options: RateLimitOptions): void => {
  if (options.trustProxy === false) {
    app.set("trust proxy", false);
    return;
  }
  if (options.trustProxy !== undefined) {
    app.set("trust proxy", options.trustProxy);
    return;
  }
  // Default off so client X-Forwarded-For cannot rotate unauthenticated buckets.
  // Cloud Run / GFE: pass trustProxy: 1.
  app.set("trust proxy", false);
};
