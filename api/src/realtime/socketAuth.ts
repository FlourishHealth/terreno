import {authorize, UnauthorizedError} from "@thream/socketio-jwt";
import type {Socket} from "socket.io";

import type {UserModel} from "../auth";
import type {BetterAuthInstance} from "../betterAuthSetup";
import {logger} from "../logger";
import {findOneOrNoneFor} from "../plugins";
import type {SocketWithDecodedToken} from "./socketUser";

/**
 * Pluggable socket authentication for RealtimeApp.
 *
 * The Socket.io handshake token (`socket.handshake.auth.token`) is validated by a chain of
 * validators tried in order; the first one that succeeds populates `socket.decodedToken`
 * (the shape `getSocketUser` consumes) and the connection proceeds. If every validator
 * fails, the connection is rejected with the last validator's error.
 *
 * Validators:
 * 1. Legacy JWT (default, always first) — the existing `@thream/socketio-jwt` middleware,
 *    wrapped unchanged so accepted payloads, secret handling, and error shapes are
 *    byte-for-byte identical to the previous hardcoded setup.
 * 2. Better Auth session (optional) — enabled via `RealtimeAppOptions.betterAuth`. The
 *    handshake token is validated as a Better Auth session via `auth.api.getSession`,
 *    and `socket.decodedToken` is populated as `{id, admin, isAnonymous: false}` exactly
 *    like the JWT path.
 */

/** The subset of a Socket.io socket the validators need. Lets tests pass a stub. */
export interface AuthenticatableSocket extends SocketWithDecodedToken {
  handshake: {auth: {[key: string]: unknown; token?: string}};
  encodedToken?: string;
}

/**
 * A socket auth validator: resolve after populating `socket.decodedToken`, or reject to
 * let the next validator in the chain try.
 */
export type SocketAuthValidator = (socket: AuthenticatableSocket) => Promise<void>;

/** Options for the Better Auth session validator. */
export interface BetterAuthSocketOptions {
  /** The instance returned by `createBetterAuth`. */
  auth: BetterAuthInstance;
  /**
   * Optional application user model. When provided, the Better Auth user is resolved to
   * the app user (via `betterAuthId`) so `decodedToken.id`/`admin` match the identity the
   * REST layer uses. Without it, the Better Auth user id is used and `admin` is false.
   */
  userModel?: UserModel;
}

/**
 * Legacy JWT validator: wraps the `@thream/socketio-jwt` middleware so its observable
 * behavior (token format requirements, secret verification, `decodedToken` payload,
 * `UnauthorizedError` shapes) is identical to the previous direct `io.use(authorize(...))`.
 */
export const createLegacyJwtValidator = (tokenSecret: string): SocketAuthValidator => {
  const middleware = authorize({secret: tokenSecret});
  return (socket) =>
    new Promise<void>((resolve, reject) => {
      // The socketio-jwt middleware types demand a full Socket; it only reads
      // handshake.auth.token and writes encodedToken/decodedToken.
      middleware(socket as unknown as Socket, (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
};

/** Strip an optional `Bearer ` prefix from the handshake token. */
const extractRawToken = (socket: AuthenticatableSocket): string | null => {
  const {token} = socket.handshake.auth;
  if (typeof token !== "string" || token.length === 0) {
    return null;
  }
  const parts = token.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    return parts[1];
  }
  return token;
};

/**
 * Better Auth session validator: treats the handshake token as a Better Auth session token
 * and validates it via `auth.api.getSession` (the same lookup the HTTP session middleware
 * uses). The token is presented both as a bearer Authorization header (for the Better Auth
 * bearer plugin) and as the session cookie, so either transport configuration works.
 */
export const createBetterAuthValidator = (
  options: BetterAuthSocketOptions
): SocketAuthValidator => {
  const {auth, userModel} = options;
  return async (socket) => {
    const rawToken = extractRawToken(socket);
    if (!rawToken) {
      throw new UnauthorizedError("credentials_required", {message: "no token provided"});
    }

    const session = await auth.api.getSession({
      headers: {
        authorization: `Bearer ${rawToken}`,
        cookie: `better-auth.session_token=${rawToken}`,
      } as Record<string, string>,
    });

    const betterAuthUserId = session?.user?.id;
    if (!betterAuthUserId) {
      throw new UnauthorizedError("invalid_token", {
        message: "Unauthorized: Better Auth session is missing or invalid",
      });
    }

    let id = String(betterAuthUserId);
    let admin = false;
    if (userModel) {
      const appUser = (await findOneOrNoneFor(userModel, {
        betterAuthId: betterAuthUserId,
      })) as unknown as {_id?: unknown; admin?: boolean} | null;
      if (!appUser?._id) {
        throw new UnauthorizedError("invalid_token", {
          message: "Unauthorized: Better Auth user has no application user",
        });
      }
      id = String(appUser._id);
      admin = appUser.admin === true;
    }

    socket.decodedToken = {admin, id, isAnonymous: false};
  };
};

/**
 * Build the Socket.io auth middleware from a validator chain: validators run in order and
 * the first success wins; when all fail the connection is rejected with the last error.
 */
export const createSocketAuthMiddleware = ({
  tokenSecret,
  betterAuth,
  extraValidators = [],
}: {
  /** Secret for the legacy JWT validator (same handling as before the refactor). */
  tokenSecret: string;
  /** Enables the Better Auth session validator after the legacy JWT validator. */
  betterAuth?: BetterAuthSocketOptions;
  /** Additional validators appended to the chain (after JWT and Better Auth). */
  extraValidators?: SocketAuthValidator[];
}): ((socket: Socket, next: (error?: Error) => void) => void) => {
  const validators: SocketAuthValidator[] = [createLegacyJwtValidator(tokenSecret)];
  if (betterAuth) {
    validators.push(createBetterAuthValidator(betterAuth));
  }
  validators.push(...extraValidators);

  return (socket, next): void => {
    void (async () => {
      let lastError: Error = new UnauthorizedError("credentials_required", {
        message: "no token provided",
      });
      for (const validator of validators) {
        try {
          await validator(socket as unknown as AuthenticatableSocket);
          next();
          return;
        } catch (error: unknown) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }
      logger.debug(`[realtime] Socket authentication failed: ${lastError.message}`);
      next(lastError);
    })();
  };
};
