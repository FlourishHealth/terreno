/**
 * BetterAuthApp plugin for @terreno/api.
 *
 * Registers Better Auth as a TerrenoPlugin, mounting routes, session middleware,
 * and user sync on an existing Express application.
 */

import type express from "express";
import type {UserModel} from "./auth";
import type {BetterAuthConfig} from "./betterAuth";
import {
  type BetterAuthInstance,
  createBetterAuth,
  createBetterAuthSessionMiddleware,
  getMongoClientFromMongoose,
  mountBetterAuthRoutes,
  setupBetterAuthUserSync,
} from "./betterAuthSetup";
import {logger} from "./logger";
import type {TerrenoPlugin} from "./terrenoPlugin";

export interface BetterAuthAppOptions {
  config: BetterAuthConfig;
  userModel?: UserModel;
}

export class BetterAuthApp implements TerrenoPlugin {
  private auth: BetterAuthInstance | undefined;
  private options: BetterAuthAppOptions;

  constructor(options: BetterAuthAppOptions) {
    this.options = options;
  }

  register(app: express.Application): void {
    const {config, userModel} = this.options;

    const mongoClient = getMongoClientFromMongoose();
    this.auth = createBetterAuth({
      config,
      mongoClient,
      userModel,
    });

    const basePath = config.basePath ?? "/api/auth";
    mountBetterAuthRoutes(app, this.auth, basePath);

    app.use(createBetterAuthSessionMiddleware(this.auth, userModel));

    if (userModel) {
      setupBetterAuthUserSync(this.auth, userModel);
    }

    logger.info("Better Auth initialized via BetterAuthApp plugin");
  }

  getAuth(): BetterAuthInstance | undefined {
    return this.auth;
  }
}
