import type {OutgoingMessage} from "node:http";
import * as Sentry from "@sentry/bun";
import cron from "cron";
import express, {type Router} from "express";
import type jwt from "jsonwebtoken";
import cloneDeep from "lodash/cloneDeep";
import onFinished from "on-finished";
import passport from "passport";
import type {ModelRouterOptions} from "./api";
import {type LoggingOptions, logger} from "./logger";
import {sendToSlack} from "./notifiers/slackNotifier";

const SLOW_READ_MAX = 200;
const SLOW_WRITE_MAX = 500;
const IS_JEST = process.env.JEST_WORKER_ID !== undefined;

export const setupEnvironment = (): void => {
  if (!process.env.TOKEN_ISSUER) {
    throw new Error("TOKEN_ISSUER must be set in env.");
  }
  if (!process.env.TOKEN_SECRET) {
    throw new Error("TOKEN_SECRET must be set.");
  }
  if (!process.env.REFRESH_TOKEN_SECRET) {
    throw new Error("REFRESH_TOKEN_SECRET must be set.");
  }
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET must be set.");
  }
  if (!process.env.TOKEN_EXPIRES_IN && !IS_JEST) {
    logger.warn("TOKEN_EXPIRES_IN is not set so using default.");
  }
  if (!process.env.REFRESH_TOKEN_EXPIRES_IN && !IS_JEST) {
    logger.warn("REFRESH_TOKEN_EXPIRES_IN not set so using default.");
  }
};

export type AddRoutes = (router: Router, options?: Partial<ModelRouterOptions<unknown>>) => void;

interface LoggableRequest {
  body?: Record<string, unknown>;
  method: string;
  originalUrl?: string;
  route?: {path: string};
  routeMount?: string | string[];
  url?: string;
  user?: {
    admin?: boolean;
    id?: string;
    testUser?: boolean;
    type?: string;
  };
}

interface LoggableResponse {
  locals?: {loggingOptions?: LoggingOptions};
  statusCode?: number;
}

const logRequestsFinished = (req: LoggableRequest, res: LoggableResponse, startTime: bigint) => {
  const options = (res.locals?.loggingOptions ?? {}) as LoggingOptions;

  const slowReadMs = options.logSlowRequestsReadMs ?? SLOW_READ_MAX;
  const slowWriteMs = options.logSlowRequestsWriteMs ?? SLOW_WRITE_MAX;

  const diff = process.hrtime.bigint() - startTime;
  const diffInMs = Number(diff) / 1000000;
  let pathName = "unknown";
  if (req.route && req.routeMount) {
    pathName = `${req.routeMount}${req.route.path}`;
  } else if (req.route) {
    pathName = req.route.path;
  } else if (res.statusCode != null && res.statusCode < 400) {
    logger.warn(`Request without route: ${req.originalUrl}`);
  }
  if (process.env.DISABLE_LOG_ALL_REQUESTS !== "true") {
    logger.debug(`${req.method} -> ${req.originalUrl} ${res.statusCode} ${`${diffInMs}ms`}`);
  }
  if (options.logSlowRequests) {
    if (diffInMs > slowReadMs && req.method === "GET") {
      logger.warn(
        `Slow GET request, ${JSON.stringify({
          pathName,
          requestTime: diffInMs,
          url: req.originalUrl,
        })}`
      );
    } else if (diffInMs > slowWriteMs) {
      logger.warn(
        `Slow write request ${JSON.stringify({
          pathName,
          requestTime: diffInMs,
          url: req.originalUrl,
        })}`
      );
    }
  }
};

export const logRequests = (
  req: LoggableRequest,
  res: LoggableResponse,
  next: express.NextFunction
): void => {
  const startTime = process.hrtime.bigint();

  let userString = "";
  if (req.user) {
    let type = "User";
    if (req.user?.admin) {
      type = "Admin";
    } else if (req.user?.testUser) {
      type = "Test User";
    } else if (req.user?.type) {
      type = req.user?.type;
    }
    userString = ` <${type}:${req.user.id}>`;
  }

  let body = "";
  if (req.body && Object.keys(req.body).length > 0) {
    const bodyCopy = cloneDeep(req.body);
    if (bodyCopy.password) {
      bodyCopy.password = "<PASSWORD>";
    }
    body = ` Body: ${JSON.stringify(bodyCopy)}`;
  }

  if (process.env.DISABLE_LOG_ALL_REQUESTS !== "true") {
    logger.debug(`${req.method} <- ${req.url}${userString}${body}`);
  }
  onFinished(res as unknown as OutgoingMessage, () => logRequestsFinished(req, res, startTime));
  next();
};

export const createRouter = (
  rootPath: string,
  addRoutes: AddRoutes,
  middleware: express.RequestHandler[] = []
): Array<string | express.RequestHandler | Router> => {
  const routePathMiddleware = (
    req: express.Request & {routeMount?: string[]},
    _res: express.Response,
    next: express.NextFunction
  ): void => {
    if (!req.routeMount) {
      req.routeMount = [];
    }
    req.routeMount.push(rootPath);
    next();
  };

  const router = express.Router();
  router.use(routePathMiddleware);
  addRoutes(router);
  return [rootPath, ...middleware, router];
};

export const createRouterWithAuth = (
  rootPath: string,
  addRoutes: (router: Router) => void,
  middleware: express.RequestHandler[] = []
): Array<string | express.RequestHandler | Router> => {
  return createRouter(rootPath, addRoutes, [
    passport.authenticate("firebase-jwt", {session: false}),
    ...middleware,
  ]);
};

export interface AuthOptions {
  // noExplicitAny: user shape is provided by the consumer's User model — any preserves the loose-binding contract
  // biome-ignore lint/suspicious/noExplicitAny: user shape is provided by the consumer's User model — any preserves the loose-binding contract
  generateJWTPayload?: (user: any) => Record<string, unknown>;
  // noExplicitAny: user shape is provided by the consumer's User model — any preserves the loose-binding contract
  // biome-ignore lint/suspicious/noExplicitAny: user shape is provided by the consumer's User model — any preserves the loose-binding contract
  generateTokenExpiration?: (user: any) => number | jwt.SignOptions["expiresIn"];
  // noExplicitAny: user shape is provided by the consumer's User model — any preserves the loose-binding contract
  // biome-ignore lint/suspicious/noExplicitAny: user shape is provided by the consumer's User model — any preserves the loose-binding contract
  generateRefreshTokenExpiration?: (user: any) => number | jwt.SignOptions["expiresIn"];
}

export const cronjob = (
  name: string,
  schedule: "hourly" | "minutely" | string,
  callback: () => void
): void => {
  const cronSchedule =
    schedule === "hourly" ? "0 * * * *" : schedule === "minutely" ? "* * * * *" : schedule;
  logger.info(`Adding cronjob ${name}, running at: ${cronSchedule}`);
  try {
    new cron.CronJob(cronSchedule, callback, null, true, "America/Chicago");
  } catch (error) {
    throw new Error(`Failed to create cronjob: ${error}`);
  }
};

export interface WrapScriptOptions {
  onFinish?: (result?: unknown) => void | Promise<void>;
  terminateTimeout?: number; // in seconds, defaults to 300. Set to 0 to have no termination timeout.
  slackChannel?: string;
}
export const wrapScript = async (
  func: () => Promise<unknown>,
  options: WrapScriptOptions = {}
): Promise<void> => {
  const name = require.main?.filename.split("/").slice(-1)[0].replace(".ts", "");
  logger.info(`Running script ${name}`);
  await sendToSlack(`Running script ${name}`, {
    slackChannel: options.slackChannel,
  });

  if (options.terminateTimeout !== 0) {
    const warnTime = ((options.terminateTimeout ?? 300) / 2) * 1000;
    const closeTime = (options.terminateTimeout ?? 300) * 1000;
    setTimeout(async () => {
      const msg = `Script ${name} is taking a while, currently ${warnTime / 1000} seconds`;
      await sendToSlack(msg);
      logger.warn(msg);
    }, warnTime);

    setTimeout(async () => {
      const msg = `Script ${name} took too long, exiting`;
      await sendToSlack(msg);
      logger.error(msg);
      Sentry.captureException(new Error(`Script ${name} took too long, exiting`));
      await Sentry.flush();
      process.exit(2);
    }, closeTime);
  }

  let result: unknown;
  try {
    result = await func();
    if (options.onFinish) {
      await options.onFinish(result);
    }
  } catch (error) {
    Sentry.captureException(error);
    logger.error(`Error running script ${name}: ${error}\n${(error as Error).stack}`);
    await sendToSlack(`Error running script ${name}: ${error}\n${(error as Error).stack}`);
    await Sentry.flush();
    process.exit(1);
  }
  await sendToSlack(`Success running script ${name}: ${result}`);
  process.exit(0);
};
