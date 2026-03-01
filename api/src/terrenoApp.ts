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

/**
 * Configuration options for TerrenoApp.
 */
export interface TerrenoAppOptions {
  /** Mongoose User model with passport-local-mongoose plugin */
  userModel: UserMongooseModel;
  /** CORS origin configuration (default: "*") */
  corsOrigin?: CorsOrigin;
  /** Logging configuration options */
  loggingOptions?: LoggingOptions;
  /** Authentication configuration options */
  authOptions?: AuthOptions;
  /** GitHub OAuth configuration (enables GitHub authentication if provided) */
  githubAuth?: GitHubAuthOptions;
  /** Skip calling app.listen() in start() method (useful for testing) */
  skipListen?: boolean;
  /** Sentry configuration options */
  sentryOptions?: Sentry.BunOptions;
  /** Maximum number of array items in query parameters (default: 200) */
  arrayLimit?: number;
  /** Whether to log all incoming requests (default: true) */
  logRequests?: boolean;
}

/**
 * Fluent API for building Express applications with Terreno framework.
 *
 * TerrenoApp provides an alternative to `setupServer` using a registration
 * pattern instead of callbacks. Build applications by registering model
 * routers and plugins, then calling `start()` to begin listening.
 *
 * The middleware stack is configured in this order:
 * 1. CORS
 * 2. Custom middleware (via addMiddleware)
 * 3. JSON body parser
 * 4. Auth routes (/auth/login, /auth/signup, etc.)
 * 5. JWT authentication setup
 * 6. Request logging
 * 7. Sentry scopes
 * 8. OpenAPI middleware
 * 9. /auth/me routes
 * 10. GitHub OAuth routes (if enabled)
 * 11. Registered model routers and plugins
 * 12. Error handling middleware
 *
 * @example
 * ```typescript
 * // Basic usage with model routers
 * const todoRouter = modelRouter("/todos", Todo, {
 *   permissions: { list: [Permissions.IsAuthenticated], ... },
 * });
 *
 * const app = new TerrenoApp({ userModel: User })
 *   .register(todoRouter)
 *   .register(new HealthApp())
 *   .start();
 * ```
 *
 * @example
 * ```typescript
 * // With custom middleware
 * const app = new TerrenoApp({
 *   userModel: User,
 *   corsOrigin: ["https://app.example.com"],
 *   loggingOptions: { logRequests: true },
 *   githubAuth: {
 *     clientId: process.env.GITHUB_CLIENT_ID!,
 *     clientSecret: process.env.GITHUB_CLIENT_SECRET!,
 *     callbackURL: process.env.GITHUB_CALLBACK_URL!,
 *   },
 * })
 *   .addMiddleware((req, res, next) => {
 *     res.setHeader("X-Custom-Header", "value");
 *     next();
 *   })
 *   .register(todoRouter)
 *   .register(userRouter)
 *   .start();
 * ```
 *
 * @see setupServer for the callback-based alternative
 * @see TerrenoPlugin for creating reusable plugins
 * @see modelRouter for creating CRUD route registrations
 */
export class TerrenoApp {
  private options: TerrenoAppOptions;
  private registrations: (ModelRouterRegistration | TerrenoPlugin)[] = [];
  private middlewareFns: (express.RequestHandler | ((app: express.Application) => void))[] = [];

  /**
   * Create a new TerrenoApp builder.
   *
   * @param options - Application configuration options including user model and auth settings
   */
  constructor(options: TerrenoAppOptions) {
    this.options = options;
  }

  /**
   * Register a model router or plugin with the application.
   *
   * Model routers are created with `modelRouter("/path", Model, options)` and
   * provide CRUD endpoints. Plugins implement `TerrenoPlugin` interface and
   * can register custom routes and middleware.
   *
   * Registrations are mounted in the order they are added.
   *
   * @param registration - A ModelRouterRegistration from modelRouter() or a TerrenoPlugin instance
   * @returns This TerrenoApp instance for method chaining
   *
   * @example
   * ```typescript
   * const todoRouter = modelRouter("/todos", Todo, options);
   * const healthPlugin = new HealthApp({ path: "/health" });
   *
   * app.register(todoRouter).register(healthPlugin);
   * ```
   */
  register(registration: ModelRouterRegistration | TerrenoPlugin): this {
    this.registrations.push(registration);
    return this;
  }

  /**
   * Add custom Express middleware to the application.
   *
   * Middleware is added BEFORE JSON body parsing and authentication setup,
   * allowing you to modify incoming requests early in the middleware stack.
   *
   * @param fn - Express middleware function or a function that configures the app
   * @returns This TerrenoApp instance for method chaining
   *
   * @example
   * ```typescript
   * app.addMiddleware((req, res, next) => {
   *   res.setHeader("X-Request-ID", req.id);
   *   next();
   * });
   * ```
   */
  addMiddleware(fn: express.RequestHandler | ((app: express.Application) => void)): this {
    this.middlewareFns.push(fn);
    return this;
  }

  /**
   * Build the Express application without starting the server.
   *
   * Configures the complete middleware stack including:
   * - CORS, JSON parsing, authentication, logging, Sentry, OpenAPI
   * - All registered model routers and plugins
   * - Error handling middleware
   *
   * Use this method when you need the Express app instance for testing
   * or custom server setup. For normal use, call `start()` instead.
   *
   * @returns Configured Express application instance
   *
   * @example
   * ```typescript
   * const app = new TerrenoApp({ userModel: User })
   *   .register(todoRouter)
   *   .build();
   *
   * // Use app for testing with supertest
   * await request(app).get("/todos").expect(200);
   * ```
   */
  build(): express.Application {
    setupLogging(this.options.loggingOptions);

    const app = express();
    const options = this.options;

    app.set("query parser", (str: string) =>
      qs.parse(str, {arrayLimit: options.arrayLimit ?? 200})
    );

    app.use(cors({credentials: true, origin: options.corsOrigin ?? "*"}));

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
    app.use((req: any, _res: any, next: any) => {
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

  /**
   * Build the Express application and start listening on the configured port.
   *
   * Calls `build()` to configure the application, then starts an HTTP server
   * listening on the port specified by the `PORT` environment variable (default: 9000).
   * If `skipListen` option is true, the app is built but the server is not started.
   *
   * @returns Configured Express application instance
   *
   * @throws Process exits with code 1 if the server fails to start
   *
   * @example
   * ```typescript
   * // Start server on port 3000
   * process.env.PORT = "3000";
   * const app = new TerrenoApp({ userModel: User })
   *   .register(todoRouter)
   *   .start();
   * ```
   */
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
