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
  private sessionMiddlewareMounted = false;

  constructor(options: BetterAuthAppOptions) {
    this.options = options;
  }

  ensureAuth(): BetterAuthInstance {
    if (this.auth) {
      return this.auth;
    }
    const {config, userModel} = this.options;
    this.auth = createBetterAuth({
      config,
      mongoClient: getMongoClientFromMongoose(),
      userModel,
    });
    if (userModel) {
      setupBetterAuthUserSync(this.auth, userModel);
    }
    return this.auth;
  }

  markSessionMiddlewareMounted(): void {
    this.sessionMiddlewareMounted = true;
  }

  register(app: express.Application): void {
    const {config, userModel} = this.options;
    const auth = this.ensureAuth();

    const basePath = config.basePath ?? "/api/auth";
    mountBetterAuthRoutes(app, auth, basePath);

    if (!this.sessionMiddlewareMounted) {
      app.use(createBetterAuthSessionMiddleware(auth, userModel));
      this.sessionMiddlewareMounted = true;
    }

    logger.info("Better Auth initialized via BetterAuthApp plugin");
  }

  getAuth(): BetterAuthInstance | undefined {
    return this.auth;
  }
}
