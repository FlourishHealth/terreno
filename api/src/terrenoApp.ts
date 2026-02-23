import * as Sentry from "@sentry/bun";
import openapi from "@wesleytodd/openapi";
import cors from "cors";
import express from "express";
import qs from "qs";

import type {ModelRouterRegistration} from "./api";
import {addAuthRoutes, addMeRoutes, setupAuth, type UserModel as UserMongooseModel} from "./auth";
import {apiErrorMiddleware, apiUnauthorizedMiddleware} from "./errors";
import {type AuthOptions, logRequests} from "./expressServer";
import {addGitHubAuthRoutes, type GitHubAuthOptions, setupGitHubAuth} from "./githubAuth";
import {type LoggingOptions, logger, setupLogging} from "./logger";
import {openApiEtagMiddleware} from "./openApiEtag";
import type {TerrenoPlugin} from "./terrenoPlugin";

type CorsOrigin =
  | string
  | boolean
  | RegExp
  | Array<boolean | string | RegExp>
  | ((
      requestOrigin: string | undefined,
      callback: (
        err: Error | null,
        origin?: boolean | string | RegExp | Array<boolean | string | RegExp>
      ) => void
    ) => void);

export interface TerrenoAppOptions {
  userModel: UserMongooseModel;
  corsOrigin?: CorsOrigin;
  loggingOptions?: LoggingOptions;
  authOptions?: AuthOptions;
  githubAuth?: GitHubAuthOptions;
  skipListen?: boolean;
  sentryOptions?: Sentry.BunOptions;
  arrayLimit?: number;
  logRequests?: boolean;
}

export class TerrenoApp {
  private options: TerrenoAppOptions;
  private registrations: (ModelRouterRegistration | TerrenoPlugin)[] = [];
  private middlewareFns: (express.RequestHandler | ((app: express.Application) => void))[] = [];

  constructor(options: TerrenoAppOptions) {
    this.options = options;
  }

  register(registration: ModelRouterRegistration | TerrenoPlugin): this {
    this.registrations.push(registration);
    return this;
  }

  addMiddleware(fn: express.RequestHandler | ((app: express.Application) => void)): this {
    this.middlewareFns.push(fn);
    return this;
  }

  build(): express.Application {
    setupLogging(this.options.loggingOptions);

    const app = express();
    const options = this.options;

    app.set("query parser", (str: string) =>
      qs.parse(str, {arrayLimit: options.arrayLimit ?? 200})
    );

    app.use(cors({origin: options.corsOrigin ?? "*"}));

    // Apply custom middleware before JSON parsing
    for (const fn of this.middlewareFns) {
      if (fn.length <= 3) {
        // express.RequestHandler (req, res, next)
        app.use(fn as express.RequestHandler);
      } else {
        // Function that receives the app
        (fn as (app: express.Application) => void)(app);
      }
    }

    app.use(express.json());

    // Auth routes (login/signup/refresh_token) before JWT middleware
    addAuthRoutes(app, options.userModel as any, options.authOptions);
    setupAuth(app as any, options.userModel as any);

    if (options.logRequests !== false) {
      app.use(logRequests);
    }

    // Store logging options on the response locals
    app.use((_req, res, next) => {
      res.locals.loggingOptions = options.loggingOptions;
      next();
    });

    // Sentry scopes
    app.all("*", (req: any, _res: any, next: any) => {
      const transactionId = req.header("X-Transaction-ID");
      const sessionId = req.header("X-Session-ID");
      if (transactionId) {
        Sentry.getCurrentScope().setTag("transaction_id", transactionId);
      }
      if (sessionId) {
        Sentry.getCurrentScope().setTag("session_id", sessionId);
      }
      if (req.user?._id) {
        Sentry.getCurrentScope().setTag("user", req.user._id);
      }
      next();
    });

    // OpenAPI
    app.use(openApiEtagMiddleware);
    const oapi = openapi({
      info: {
        description: "Generated docs from an Express api",
        title: "Express Application",
        version: "1.0.0",
      },
      openapi: "3.0.0",
    });
    app.use(oapi);

    if (process.env.ENABLE_SWAGGER === "true") {
      app.use("/swagger", oapi.swaggerui());
    }

    addMeRoutes(app, options.userModel as any, options.authOptions);

    // GitHub OAuth
    if (options.githubAuth) {
      setupGitHubAuth(app, options.userModel as any, options.githubAuth);
      addGitHubAuthRoutes(app, options.userModel as any, options.githubAuth, options.authOptions);
    }

    // Mount registered model routers and plugins
    for (const registration of this.registrations) {
      if (this.isModelRouterRegistration(registration)) {
        app.use(registration.path, registration.router);
      } else {
        registration.register(app);
      }
    }

    // Inject openApi into model router options for registered routers
    // The openApi middleware handles this via the oapi instance already mounted on the app

    Sentry.setupExpressErrorHandler(app);

    // Error middleware
    app.use(apiUnauthorizedMiddleware);
    app.use(apiErrorMiddleware);

    app.use(function onError(err: any, _req: any, res: any, _next: any) {
      logger.error(`Fallthrough error: ${err}${err?.stack ? `\n${err.stack}` : ""}}`);
      Sentry.captureException(err);
      res.statusCode = 500;
      res.end(`${res.sentry}\n`);
    });

    return app;
  }

  start(): express.Application {
    const app = this.build();

    if (!this.options.skipListen) {
      const port = process.env.PORT || "9000";
      try {
        app.listen(port, () => {
          logger.info(`Listening on port ${port}`);
        });
      } catch (error) {
        logger.error(`Error trying to start HTTP server: ${error}\n${(error as any).stack}`);
        process.exit(1);
      }
    }

    return app;
  }

  private isModelRouterRegistration(
    registration: ModelRouterRegistration | TerrenoPlugin
  ): registration is ModelRouterRegistration {
    return (registration as ModelRouterRegistration).__type === "modelRouter";
  }
}
