import jwt from "jsonwebtoken";
import {DateTime} from "luxon";

import type {User, UserModel} from "../auth";
import type {BetterAuthInstance} from "../betterAuthSetup";
import {logger} from "../logger";
import {McpServiceToken} from "../models/mcpServiceToken";
import {findOneOrNoneFor} from "../plugins";

export interface MCPAuthContext {
  userModel: UserModel;
  betterAuth?: BetterAuthInstance;
  mcpServiceTokens?: boolean;
}

/**
 * Reject a disabled account the way the JWT middleware's 401 does. Without this an MCP
 * client could keep calling tools with a still-valid token or session after the account
 * was disabled, which REST already refuses.
 */
const rejectIfDisabled = (user: User | undefined, source: string): User | undefined => {
  if (!user) {
    return undefined;
  }
  if ((user as {disabled?: boolean}).disabled) {
    logger.warn(`[mcp] User ${user.id} is disabled, rejecting ${source} credentials`);
    return undefined;
  }
  return user;
};

/**
 * Extract user from raw headers using whichever auth provider is configured.
 * Works with both JWT and Better Auth, mirroring authenticateMiddleware behavior.
 */
export const extractUserFromHeaders = async (
  headers: Record<string, string | string[] | undefined>,
  context: MCPAuthContext
): Promise<User | undefined> => {
  const {userModel, betterAuth, mcpServiceTokens} = context;
  const authorization =
    typeof headers.authorization === "string"
      ? headers.authorization
      : Array.isArray(headers.authorization)
        ? headers.authorization[0]
        : undefined;
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : authorization;

  // Resolve MCP service tokens before session/JWT auth because mcp_ is a distinct credential type.
  if (mcpServiceTokens && token?.startsWith("mcp_")) {
    const serviceToken = await McpServiceToken.verify(token);
    if (!serviceToken) {
      return undefined;
    }
    const user = await userModel.findById(serviceToken.userId);
    const activeUser = rejectIfDisabled(user as unknown as User | undefined, "MCP service token");
    if (!activeUser) {
      return undefined;
    }
    void McpServiceToken.updateOne(
      {_id: serviceToken._id},
      {$set: {lastUsedAt: DateTime.now().toJSDate()}}
    ).catch((error) => {
      logger.debug(`MCP service token last-used update failed: ${error}`);
    });
    return activeUser;
  }

  // Try Better Auth first if configured.
  if (betterAuth) {
    try {
      const session = await betterAuth.api.getSession({
        headers: headers as Record<string, string>,
      });

      if (session?.user && session?.session) {
        // betterAuthId is unique per user — findById-like lookup that may return null.
        // findOneOrNoneFor keeps the repo's "never call findOne directly" convention while
        // working whether or not the consumer's model has the findOneOrNone plugin applied.
        const appUser = await findOneOrNoneFor(userModel, {betterAuthId: session.user.id});
        if (appUser) {
          return rejectIfDisabled(appUser as unknown as User, "Better Auth");
        }
      }
    } catch (error) {
      logger.debug(`MCP Better Auth session extraction failed: ${error}`);
    }
  }

  // Try JWT auth
  if (!authorization) {
    return undefined;
  }

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
    return rejectIfDisabled(user as unknown as User | undefined, "JWT");
  } catch (error) {
    logger.debug(`MCP JWT verification failed: ${error}`);
    return undefined;
  }
};
