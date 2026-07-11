import {randomUUID} from "node:crypto";
import express from "express";
import jwt, {type JwtPayload} from "jsonwebtoken";
import {DateTime} from "luxon";
import type {Model, ObjectId} from "mongoose";
import ms, {type StringValue} from "ms";
import passport from "passport";
import {Strategy as AnonymousStrategy} from "passport-anonymous";
import {
  type JwtFromRequestFunction,
  Strategy as JwtStrategy,
  type StrategyOptions,
} from "passport-jwt";
import {Strategy as LocalStrategy} from "passport-local";

import {APIError, apiErrorMiddleware, errorMessage} from "./errors";
import type {AuthOptions} from "./expressServer";
import {logger} from "./logger";
import {
  getSessionIdFromJwtPayload,
  type JwtSessionPayload,
  setRequestContext,
  updateRequestContextFromRequest,
} from "./requestContext";

export interface User {
  _id: ObjectId | string;
  id: string;
  // Whether the user should be treated as an admin or not.
  // Admins can have extra abilities in permissions declarations
  admin: boolean;
  /**
   * We support anonymous users, which do not yet have login information.
   * This can be helpful for pre-signup users.
   */
  isAnonymous?: boolean;
}

export interface UserModel extends Model<User> {
  createAnonymousUser?: (id?: string) => Promise<User>;
  // Allows additional setup during signup. This will be passed the rest of req.body from the signup
  postCreate?: (body: Record<string, unknown>) => Promise<void>;

  // biome-ignore lint/suspicious/noExplicitAny: passport-local-mongoose return types are untyped
  createStrategy(): any;
  // biome-ignore lint/suspicious/noExplicitAny: passport-local-mongoose return types are untyped
  serializeUser(): any;
  // biome-ignore lint/suspicious/noExplicitAny: passport-local-mongoose return types are untyped
  deserializeUser(): any;
  // biome-ignore lint/suspicious/noExplicitAny: passport-local-mongoose return types are untyped
  findByUsername(username: string, findOpts: any): any;
}

export interface GenerateTokensOptions {
  sessionId?: string;
}

export const authenticateMiddleware = (anonymous = false) => {
  const strategies = ["jwt"];
  if (anonymous) {
    strategies.push("anonymous");
  }
  const passportAuth = passport.authenticate(strategies, {
    failureMessage: false, // this is just avoiding storing the message in the session
    failWithError: true,
    session: false,
  });
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.user) {
      return next();
    }
    return passportAuth(req, res, next);
  };
};

export const signupUser = async (
  userModel: UserModel,
  email: string,
  password: string,
  body?: Record<string, unknown>
) => {
  // Strip email and password from the body. They can cause mongoose to throw an error if strict is
  // set.
  const {email: _email, password: _password, ...bodyRest} = body ?? {};

  try {
    // biome-ignore lint/suspicious/noExplicitAny: passport-local-mongoose's register() is untyped
    const user = await (userModel as any).register({email, ...bodyRest}, password);

    if (user.postCreate) {
      try {
        await user.postCreate(bodyRest);
      } catch (error: unknown) {
        logger.error(`Error in user.postCreate: ${error}`);
        throw error;
      }
    }
    await user.save();
    return user;
  } catch (error: unknown) {
    const message = errorMessage(error);
    throw new APIError({title: message});
  }
};

/** A user document exposing passport-local-mongoose's `setPassword`. */
export interface HasSetPassword {
  _id?: unknown;
  id?: string;
  setPassword: (
    password: string,
    callback?: (error?: unknown) => void
  ) => Promise<unknown> | unknown;
}

/** Upper bound on password length accepted by {@link setPasswordForUser} (D5). */
export const MAX_PASSWORD_LENGTH = 256;

/** Optional audit context for {@link setPasswordForUser} — never includes the password itself. */
export interface SetPasswordAuditContext {
  /** The admin performing the change, when set via an admin-only route. */
  adminId?: unknown;
}

/**
 * Sets a password on a passport-local-mongoose user document, returning a Promise regardless of
 * whether the installed version of `setPassword` is callback- or promise-based. Newer versions
 * return a promise while older ones only invoke the callback; this helper normalizes both and
 * rejects after `timeoutMs` (default 15s) if neither settles. Call `user.save()` afterwards to
 * persist the new hash/salt.
 *
 * Rejects synchronously (before touching `setPassword`) when `password` exceeds
 * {@link MAX_PASSWORD_LENGTH} characters. When `audit.adminId` is provided (an admin-initiated
 * password change), logs a `logger.info` audit line with the admin id, target user id, and
 * timestamp — NEVER the password itself.
 */
export const setPasswordForUser = async (
  user: HasSetPassword,
  password: string,
  timeoutMs = 15_000,
  audit?: SetPasswordAuditContext
): Promise<void> => {
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new APIError({
      status: 400,
      title: `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
    });
  }
  if (audit?.adminId !== undefined) {
    const targetUserId = user._id ?? user.id ?? "unknown";
    logger.info(
      `[auth] Admin ${String(audit.adminId)} set password for user ${String(targetUserId)} ` +
        `at ${DateTime.now().toISO()}`
    );
  }
  await new Promise<void>((resolve, reject) => {
    let isSettled = false;
    const timeout = setTimeout(() => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      reject(new Error("Timed out while setting password"));
    }, timeoutMs);

    const resolveOnce = (): void => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      clearTimeout(timeout);
      resolve();
    };

    const rejectOnce = (error: unknown): void => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      clearTimeout(timeout);
      reject(error);
    };

    try {
      const maybePromise = user.setPassword(password, (error?: unknown) => {
        if (error) {
          rejectOnce(error);
          return;
        }
        resolveOnce();
      });

      if (maybePromise && typeof (maybePromise as Promise<unknown>).then === "function") {
        (maybePromise as Promise<unknown>).then(resolveOnce).catch(rejectOnce);
      }
    } catch (error) {
      rejectOnce(error);
    }
  });
};

/**
 * Generates both an access token (JWT) and a refresh token for a given user.
 *
 * This function:
 * - Signs the user's `_id` into a short-lived JWT (`token`)
 *   and a long-lived refresh token (`refreshToken`).
 * - Supports custom expiration logic
 *   and payload customization via `AuthOptions`.
 * - Reads token secrets, issuer,
 *   and default expirations from environment variables.
 * - Returns `{ token, refreshToken }`,
 *   or `{ token: null, refreshToken: null }` if the user is missing.
 *
 * It is exported to allow external implementations (such as OAuth integrations or other
 * authentication providers) to reuse and customize the same token generation logic.
 * This ensures consistent and secure token issuance across different authentication flows.
 */
export const generateTokens = async (
  user: unknown,
  authOptions?: AuthOptions,
  options: GenerateTokensOptions = {}
) => {
  const tokenSecretOrKey = process.env.TOKEN_SECRET;
  if (!tokenSecretOrKey) {
    throw new APIError({status: 500, title: "TOKEN_SECRET must be set in env."});
  }
  const tokenUser = user as {_id?: ObjectId | string} | null | undefined;
  if (!tokenUser?._id) {
    logger.warn("No user found for token generation");
    return {refreshToken: null, token: null};
  }
  const sessionId = options.sessionId ?? randomUUID();
  let payload: Record<string, unknown> = {id: String(tokenUser._id), sid: sessionId};
  if (authOptions?.generateJWTPayload) {
    payload = {...authOptions.generateJWTPayload(user), ...payload};
  }
  const tokenOptions: jwt.SignOptions = {
    expiresIn: "15m",
  };
  if (authOptions?.generateTokenExpiration) {
    tokenOptions.expiresIn = authOptions.generateTokenExpiration(user);
  } else if (process.env.TOKEN_EXPIRES_IN) {
    try {
      // this call to ms is purely for validation of the env variable. If it is invalid,
      // we want to be able to log the error and use the default.
      ms(process.env.TOKEN_EXPIRES_IN as StringValue);
      tokenOptions.expiresIn = process.env.TOKEN_EXPIRES_IN as StringValue;
    } catch (error) {
      // This error will result in using the default value above of 15m.
      logger.error(error as string);
    }
  }
  if (process.env.TOKEN_ISSUER) {
    tokenOptions.issuer = process.env.TOKEN_ISSUER;
  }

  const token = jwt.sign(payload, tokenSecretOrKey, tokenOptions);
  const refreshTokenSecretOrKey = process.env.REFRESH_TOKEN_SECRET;
  let refreshToken: string | undefined;
  if (refreshTokenSecretOrKey) {
    const refreshTokenOptions: jwt.SignOptions = {
      expiresIn: "30d",
    };
    if (authOptions?.generateRefreshTokenExpiration) {
      refreshTokenOptions.expiresIn = authOptions.generateRefreshTokenExpiration(user);
    } else if (process.env.REFRESH_TOKEN_EXPIRES_IN) {
      try {
        // this call to ms is purely for validation of the env variable. If it is invalid,
        // we want to be able to log the error and use the default.
        ms(process.env.REFRESH_TOKEN_EXPIRES_IN as StringValue);
        refreshTokenOptions.expiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN as StringValue;
      } catch (error) {
        // This error will result in using the default value above of 30d.
        logger.error(error as string);
      }
    }
    refreshToken = jwt.sign(payload, refreshTokenSecretOrKey, refreshTokenOptions);
  } else {
    logger.info("REFRESH_TOKEN_SECRET not set so refresh tokens will not be issued");
  }
  return {refreshToken, sessionId, token};
};

export const setupAuth = (app: express.Application, userModel: UserModel): void => {
  passport.use(new AnonymousStrategy());
  passport.use(userModel.createStrategy());
  passport.use(
    "signup",
    new LocalStrategy(
      {
        passReqToCallback: true,
        passwordField: "password",
        usernameField: "email",
      },
      async (req, email, password, done) => {
        try {
          done(undefined, await signupUser(userModel, email, password, req.body));
        } catch (error) {
          return done(error);
        }
      }
    ) as passport.Strategy
  );

  if (!userModel.createStrategy) {
    throw new APIError({status: 500, title: "setupAuth userModel must have .createStrategy()"});
  }

  const customTokenExtractor: JwtFromRequestFunction = (req) => {
    let token: string | null = null;
    if (req?.cookies?.jwt) {
      token = req.cookies.jwt;
    } else if (req?.headers?.authorization) {
      token = req?.headers?.authorization.split(" ")[1];
    }
    return token;
  };

  if (process.env.TOKEN_SECRET) {
    if (process.env.NODE_ENV !== "test") {
      logger.debug("Setting up JWT Authentication");
    }

    const secretOrKey = process.env.TOKEN_SECRET;
    if (!secretOrKey) {
      throw new APIError({status: 500, title: "TOKEN_SECRET must be set in env."});
    }
    const jwtOpts: StrategyOptions = {
      issuer: process.env.TOKEN_ISSUER,
      jwtFromRequest: customTokenExtractor,
      secretOrKey,
    };
    passport.use(
      "jwt",
      new JwtStrategy(jwtOpts, async (jwtPayload: JwtPayload, done) => {
        let user: User | null = null;
        if (!jwtPayload) {
          return done(null, false);
        }
        try {
          user = await userModel.findById(jwtPayload.id);
        } catch (error) {
          logger.warn(`[jwt] Error finding user from id: ${error}`);
          return done(error, false);
        }
        if (user) {
          return done(null, user);
        }
        if (userModel.createAnonymousUser) {
          logger.info("[jwt] Creating anonymous user");
          user = await userModel.createAnonymousUser();
          return done(null, user);
        }
        logger.info("[jwt] No user found from token");
        return done(null, false);
      }) as passport.Strategy
    );
  }

  // Adds req.user to the request. This may wind up duplicating requests with passport,
  // but passport doesn't give us req.user early enough.
  const decodeJWTMiddleware = async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!process.env.TOKEN_SECRET) {
      return next();
    }

    // Allow requests with a "Secret" prefix to pass through since this is a string value,
    // not a jwt that needs to be decoded
    if (req?.headers?.authorization?.split(" ")[0] === "Secret") {
      return next();
    }

    const token = customTokenExtractor(req);

    // For some reason, our app will happily put null into the authorization header when logging
    // out then back in.
    if (!token || token === "null" || token === "undefined") {
      return next();
    }

    let decoded: jwt.JwtPayload | undefined;

    try {
      decoded = jwt.verify(token, process.env.TOKEN_SECRET, {
        issuer: process.env.TOKEN_ISSUER,
      }) as jwt.JwtPayload;
    } catch (error: unknown) {
      // A bearer token that is not a JWT at all (e.g. a Better Auth opaque session
      // token) is not ours to reject — fall through so a later auth layer (Better
      // Auth session middleware) or the route's own permissions can handle it.
      // Detect this by decoding the token's header/payload structure (D1) rather
      // than counting dot-delimited segments: an opaque token can coincidentally
      // contain exactly two dots, and a malformed-but-JWT-shaped string can fail
      // this same check for the wrong reason — `jwt.decode` parses the actual
      // base64url JSON structure of each segment, which dot-counting cannot.
      // Genuine JWTs that fail verification (malformed/expired) still return 401 so the
      // client's token-refresh flow is preserved.
      if (jwt.decode(token, {complete: true}) === null) {
        return next();
      }
      const userText = req.user?._id ? ` for user ${req.user._id} ` : "";
      const expiredAt =
        error && typeof error === "object" && "expiredAt" in error
          ? (error as {expiredAt?: unknown}).expiredAt
          : undefined;
      const message = errorMessage(error);
      const details = `[jwt] Error decoding token${userText}: ${error}, expired at ${expiredAt}, current time: ${DateTime.now().toMillis()}`;
      logger.debug(details);
      return res.status(401).json({details, message});
    }
    if (decoded?.id) {
      const sessionId = getSessionIdFromJwtPayload(decoded as JwtSessionPayload);
      req.authTokenPayload = decoded as JwtSessionPayload;
      if (sessionId) {
        req.sessionId = sessionId;
        setRequestContext({sessionId});
      }
      try {
        const user = await userModel.findById(decoded.id);
        req.user = user as unknown as express.Request["user"];
        updateRequestContextFromRequest(req, res);
        if (req.user?.disabled) {
          logger.warn(`[jwt] User ${req.user.id} is disabled`);
          return res.status(401).json({status: 401, title: "User is disabled"});
        }
      } catch (error) {
        logger.warn(`[jwt] Error finding user from id: ${error}`);
      }
    }
    return next();
  };
  app.use(decodeJWTMiddleware);
  // biome-ignore lint/suspicious/noExplicitAny: express 5 type for urlencoded doesn't match RequestHandler
  app.use(express.urlencoded({extended: false}) as any);
};

export const addAuthRoutes = (
  app: express.Application,
  userModel: UserModel,
  authOptions?: AuthOptions
): void => {
  const router = express.Router();
  router.post("/login", async (req, res, next) => {
    passport.authenticate(
      "local",
      {session: false},
      async (
        err: Error | null,
        user: (User & {type?: string}) | false | null,
        info: {message?: string} | undefined
      ) => {
        if (err) {
          logger.error(`Error logging in: ${err}`);
          return next(err);
        }
        if (!user) {
          logger.warn(`Invalid login: ${info}`);
          return res.status(401).json({message: info?.message});
        }
        if (process.env.NODE_ENV !== "test") {
          logger.info(`User logged in: ${user._id}, type: ${user.type || "N/A"}`);
        }
        const tokens = await generateTokens(user, authOptions);
        if (tokens.sessionId) {
          setRequestContext({sessionId: tokens.sessionId, userId: String(user._id)});
          res.setHeader("X-Session-ID", tokens.sessionId);
        }
        return res.json({
          data: {refreshToken: tokens.refreshToken, token: tokens.token, userId: user?._id},
        });
      }
    )(req, res, next);
  });

  router.post("/refresh_token", async (req, res) => {
    if (!req.body.refreshToken) {
      logger.error(
        `No refresh token provided, must provide refreshToken in body, user id: ${req.user?.id}`
      );
      return res
        .status(401)
        .json({message: "No refresh token provided, must provide refreshToken in body"});
    }
    if (!process.env.REFRESH_TOKEN_SECRET) {
      logger.error(`No REFRESH_TOKEN_SECRET set, cannot refresh token, user id: ${req.user?.id}`);
      return res.status(401).json({message: "No REFRESH_TOKEN_SECRET set, cannot refresh token"});
    }
    const refreshTokenSecretOrKey = process.env.REFRESH_TOKEN_SECRET;
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(req.body.refreshToken, refreshTokenSecretOrKey) as JwtPayload;
    } catch (error: unknown) {
      logger.error(`Error refreshing token for user ${req.user?.id}: ${error}`);
      const message = errorMessage(error);
      return res.status(401).json({message});
    }
    if (decoded?.id) {
      const user = await userModel.findById(decoded.id);
      const sessionId = getSessionIdFromJwtPayload(decoded as JwtSessionPayload);
      const tokens = await generateTokens(user, authOptions, {sessionId});
      if (tokens.sessionId) {
        setRequestContext({
          sessionId: tokens.sessionId,
          userId: user?._id ? String(user._id) : undefined,
        });
        res.setHeader("X-Session-ID", tokens.sessionId);
      }
      logger.debug(`Refreshed token for ${user?.id}`);
      return res.json({data: {refreshToken: tokens.refreshToken, token: tokens.token}});
    }
    logger.error(`Invalid refresh token, user id: ${req.user?.id}`);
    return res.status(401).json({message: "Invalid refresh token"});
  });

  const signupDisabled = process.env.SIGNUP_DISABLED === "true";
  if (!signupDisabled) {
    router.post(
      "/signup",
      passport.authenticate("signup", {failWithError: true, session: false}),
      async (req: express.Request, res: express.Response) => {
        const tokens = await generateTokens(req.user, authOptions);
        if (tokens.sessionId) {
          setRequestContext({
            sessionId: tokens.sessionId,
            userId: req.user?._id ? String(req.user._id) : undefined,
          });
          res.setHeader("X-Session-ID", tokens.sessionId);
        }
        return res.json({
          data: {refreshToken: tokens.refreshToken, token: tokens.token, userId: req.user?._id},
        });
      }
    );
  }
  app.set("etag", false);
  app.use("/auth", router);
};

export const addMeRoutes = (
  app: express.Application,
  userModel: UserModel,
  _authOptions?: AuthOptions
): void => {
  const router = express.Router();
  router.get("/me", authenticateMiddleware(), async (req, res) => {
    if (!req.user?.id) {
      logger.debug("Not user found for /me");
      return res.sendStatus(401);
    }
    const data = await userModel.findById(req.user.id);
    if (!data) {
      logger.debug("Not user data found for /me");
      return res.sendStatus(404);
    }
    const dataObject = data.toObject() as unknown as Record<string, unknown>;
    dataObject.id = data._id;
    return res.json({data: dataObject});
  });

  router.patch("/me", authenticateMiddleware(), async (req, res) => {
    if (!req.user?.id) {
      return res.sendStatus(401);
    }
    const doc = await userModel.findById(req.user.id);
    if (!doc) {
      return res.sendStatus(404);
    }
    // TODO support limited updates for profile.
    // try {
    //   body = transform(req.body, "update", req.user);
    // } catch (e) {
    //   return res.status(403).send({message: (e as Error).message});
    // }
    try {
      Object.assign(doc, req.body);
      await doc.save();

      const dataObject = doc.toObject() as unknown as Record<string, unknown>;
      dataObject.id = doc._id;
      return res.json({data: dataObject});
    } catch (error: unknown) {
      const message = errorMessage(error);
      return res.status(403).send({message});
    }
  });

  app.set("etag", false);
  app.use("/auth", router);
  app.use(apiErrorMiddleware);
};
