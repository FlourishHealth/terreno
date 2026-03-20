import jwt from "jsonwebtoken";

import type {User, UserModel} from "../auth";
import type {BetterAuthInstance} from "../betterAuthSetup";
import {logger} from "../logger";

export interface MCPAuthContext {
  userModel: UserModel;
  betterAuth?: BetterAuthInstance;
}

/**
 * Extract user from raw headers using whichever auth provider is configured.
 * Works with both JWT and Better Auth, mirroring authenticateMiddleware behavior.
 */
export const extractUserFromHeaders = async (
  headers: Record<string, string | string[] | undefined>,
  context: MCPAuthContext
): Promise<User | undefined> => {
  const {userModel, betterAuth} = context;

  // Try Better Auth first if configured
  if (betterAuth) {
    try {
      const session = await betterAuth.api.getSession({
        headers: headers as Record<string, string>,
      });

      if (session?.user && session?.session) {
        // betterAuthId is unique per user — findById-like lookup that may return null.
        // Use findOneOrNone (safe single-doc lookup) if available, otherwise findOne.
        const q = {betterAuthId: session.user.id};
        const model = userModel as any;
        const appUser = await (typeof model.findOneOrNone === "function"
          ? model.findOneOrNone(q)
          : model.findOne(q));
        if (appUser) {
          return appUser as unknown as User;
        }
      }
    } catch (error) {
      logger.debug(`MCP Better Auth session extraction failed: ${error}`);
    }
  }

  // Try JWT auth
  const authorization =
    typeof headers.authorization === "string"
      ? headers.authorization
      : Array.isArray(headers.authorization)
        ? headers.authorization[0]
        : undefined;

  if (!authorization) {
    return undefined;
  }

  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : authorization;

  if (!token) {
    return undefined;
  }

  const tokenSecret = process.env.TOKEN_SECRET;
  if (!tokenSecret) {
    logger.warn("TOKEN_SECRET not set, cannot verify JWT for MCP request");
    return undefined;
  }

  try {
    const decoded = jwt.verify(token, tokenSecret, {
      issuer: process.env.TOKEN_ISSUER,
    }) as jwt.JwtPayload;

    const userId = decoded.id || decoded.sub;
    if (!userId) {
      return undefined;
    }

    const user = await userModel.findById(userId);
    return user as unknown as User | undefined;
  } catch (error) {
    logger.debug(`MCP JWT verification failed: ${error}`);
    return undefined;
  }
};
