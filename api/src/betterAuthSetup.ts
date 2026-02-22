/**
 * Better Auth setup and initialization for @terreno/api.
 *
 * This module provides functions to initialize Better Auth with MongoDB,
 * create session middleware, and sync users with the application User model.
 */

import {betterAuth} from "better-auth";
import {mongodbAdapter} from "better-auth/adapters/mongodb";
import {toNodeHandler} from "better-auth/node";
import type {Application, NextFunction, Request, Response} from "express";
import mongoose from "mongoose";
import type {UserModel} from "./auth";
import type {BetterAuthConfig, BetterAuthSessionData, BetterAuthUser} from "./betterAuth";
import {logger} from "./logger";

/**
 * The Better Auth instance type.
 */
export type BetterAuthInstance = ReturnType<typeof betterAuth>;

/**
 * Options for creating a Better Auth instance.
 */
export interface CreateBetterAuthOptions {
  config: BetterAuthConfig;
  mongoClient: any;
  userModel?: UserModel;
}

/**
 * Creates a Better Auth instance with MongoDB adapter.
 */
export const createBetterAuth = (options: CreateBetterAuthOptions): BetterAuthInstance => {
  const {config, mongoClient} = options;

  const secret = config.secret || process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET must be set in env or config.secret must be provided.");
  }

  const baseURL = config.baseURL || process.env.BETTER_AUTH_URL;
  if (!baseURL) {
    throw new Error("BETTER_AUTH_URL must be set in env or config.baseURL must be provided.");
  }

  const basePath = config.basePath ?? "/api/auth";

  const socialProviders: Record<string, {clientId: string; clientSecret: string}> = {};

  if (config.googleOAuth) {
    socialProviders.google = {
      clientId: config.googleOAuth.clientId,
      clientSecret: config.googleOAuth.clientSecret,
    };
  }

  if (config.appleOAuth) {
    socialProviders.apple = {
      clientId: config.appleOAuth.clientId,
      clientSecret: config.appleOAuth.clientSecret,
    };
  }

  if (config.githubOAuth) {
    socialProviders.github = {
      clientId: config.githubOAuth.clientId,
      clientSecret: config.githubOAuth.clientSecret,
    };
  }

  const auth = betterAuth({
    basePath,
    baseURL,
    database: mongodbAdapter(mongoClient.db()),
    emailAndPassword: {
      enabled: true,
    },
    secret,
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
    },
    socialProviders: Object.keys(socialProviders).length > 0 ? socialProviders : undefined,
    trustedOrigins: config.trustedOrigins ?? [],
  });

  return auth;
};

/**
 * Creates Express middleware that extracts the Better Auth session
 * and populates req.user with the application User model.
 */
export const createBetterAuthSessionMiddleware = (
  auth: BetterAuthInstance,
  userModel?: UserModel
) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const session = await auth.api.getSession({
        headers: req.headers as Record<string, string>,
      });

      if (session?.user && session?.session) {
        const betterAuthUser = session.user as BetterAuthUser;

        if (userModel) {
          // Look up the application user by betterAuthId
          const appUser = await userModel.findOne({betterAuthId: betterAuthUser.id});
          if (appUser) {
            (req as any).user = appUser;
            (req as any).betterAuthSession = session;
          } else {
            // User exists in Better Auth but not synced yet - create them
            const newUser = await syncBetterAuthUser(userModel, betterAuthUser);
            (req as any).user = newUser;
            (req as any).betterAuthSession = session;
          }
        } else {
          // No user model - just attach the Better Auth user directly
          (req as any).user = {
            _id: betterAuthUser.id,
            admin: false,
            betterAuthId: betterAuthUser.id,
            email: betterAuthUser.email,
            id: betterAuthUser.id,
            name: betterAuthUser.name,
          };
          (req as any).betterAuthSession = session;
        }
      }

      next();
    } catch (error) {
      logger.debug(`Better Auth session extraction error: ${error}`);
      next();
    }
  };
};

/**
 * Syncs a Better Auth user to the application User model.
 * Creates or updates the user as needed.
 */
export const syncBetterAuthUser = async (
  userModel: UserModel,
  betterAuthUser: BetterAuthUser,
  oauthProvider?: string
): Promise<any> => {
  try {
    const existingUser: any = await userModel.findOne({betterAuthId: betterAuthUser.id});

    if (existingUser) {
      // Update existing user if needed
      existingUser.email = betterAuthUser.email;
      if (betterAuthUser.name) {
        existingUser.name = betterAuthUser.name;
      }
      await existingUser.save();
      return existingUser;
    }

    // Check if user exists by email (migration case)
    const userByEmail: any = await userModel.findOne({email: betterAuthUser.email});
    if (userByEmail) {
      // Link existing user to Better Auth
      userByEmail.betterAuthId = betterAuthUser.id;
      if (oauthProvider) {
        userByEmail.oauthProvider = oauthProvider;
      }
      await userByEmail.save();
      return userByEmail;
    }

    // Create new user
    const newUser: any = new (userModel as any)({
      admin: false,
      betterAuthId: betterAuthUser.id,
      email: betterAuthUser.email,
      name: betterAuthUser.name || betterAuthUser.email.split("@")[0],
      oauthProvider: oauthProvider || null,
    });
    await newUser.save();
    logger.info(`Created new user from Better Auth: ${newUser.id}`);
    return newUser;
  } catch (error) {
    logger.error(`Error syncing Better Auth user: ${error}`);
    throw error;
  }
};

/**
 * Mounts Better Auth routes on the Express app.
 */
export const mountBetterAuthRoutes = (
  app: Application,
  auth: BetterAuthInstance,
  basePath = "/api/auth"
): void => {
  const handler = toNodeHandler(auth);

  // Mount at the base path with wildcard
  app.all(`${basePath}/*`, (req, res) => {
    return handler(req, res);
  });

  logger.info(`Better Auth routes mounted at ${basePath}/*`);
};

/**
 * Gets the MongoDB client from the mongoose connection.
 */
export const getMongoClientFromMongoose = (): any => {
  const connection = mongoose.connection;
  const client = (connection as any).client;
  if (!client) {
    throw new Error("Mongoose is not connected. Ensure MongoDB connection is established first.");
  }
  return client;
};

/**
 * Sets up Better Auth user sync hooks.
 * This ensures users created/updated in Better Auth are synced to the application User model.
 *
 * Note: Better Auth doesn't have built-in event hooks, so we rely on the session middleware
 * to create users on first session access.
 */
export const setupBetterAuthUserSync = (_auth: BetterAuthInstance, _userModel: UserModel): void => {
  // Better Auth v1.x doesn't expose event hooks for user creation.
  // User sync is handled in createBetterAuthSessionMiddleware when a session is accessed.
  // This function is a placeholder for future versions that may support hooks.
  logger.debug("Better Auth user sync configured (via session middleware)");
};

/**
 * Extracts Better Auth session data from the request.
 */
export const getBetterAuthSession = (req: Request): BetterAuthSessionData | null => {
  return (req as any).betterAuthSession ?? null;
};

/**
 * Checks if the request has a valid Better Auth session.
 */
export const hasBetterAuthSession = (req: Request): boolean => {
  return Boolean((req as any).betterAuthSession);
};
