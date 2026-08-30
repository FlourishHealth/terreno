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
  app.set("trust proxy", 1);
};
