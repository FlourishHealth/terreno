import type {Server} from "node:http";
import openapi from "@wesleytodd/openapi";
import cors from "cors";
import express, {type Express, type RequestHandler, type Router} from "express";
import type {Model} from "mongoose";
import qs from "qs";

import {type ModelRouterOptions, modelRouter} from "./api";
import {addAuthRoutes, addMeRoutes, setupAuth} from "./auth";
import {apiErrorMiddleware, apiUnauthorizedMiddleware} from "./errors";
import {logRequests} from "./expressServer";
import {logger, setupLogging} from "./logger";
import {openApiEtagMiddleware} from "./openApiEtag";
import type {RESTPermissions} from "./permissions";
import type {
  AddRoutesCallback,
  AppHooks,
  HealthOptions,
  MiddlewarePosition,
  ShutdownOptions,
  TerrenoAppOptions,
  TerrenoMiddlewareOptions,
  TerrenoOpenApiOptions,
} from "./terrenoAppOptions";
import * as defaults from "./terrenoAppOptions";

interface PendingModelRouter {
  path: string;
  model: Model<any>;
  options: ModelRouterOptions<any>;
}

interface PendingRoute {
  path: string;
  handler: Router | AddRoutesCallback;
}

interface PendingMiddleware {
  handler: RequestHandler;
  options?: MiddlewarePosition;
}

const isPermissionsObject = (obj: any): obj is RESTPermissions<any> => {
  return (
    obj &&
    "create" in obj &&
    "read" in obj &&
    "update" in obj &&
    "delete" in obj &&
    "list" in obj &&
    !("permissions" in obj)
  );
};

export class TerrenoApp {
  private options: TerrenoAppOptions;
  private app: Express | null = null;
  private server: Server | null = null;
  private pendingModelRouters: PendingModelRouter[] = [];
  private pendingRoutes: PendingRoute[] = [];
  private pendingMiddleware: PendingMiddleware[] = [];
  private isBuilt = false;
  private shutdownInProgress = false;
  private signalHandlers: Array<{signal: string; handler: () => void}> = [];

  private constructor(options: TerrenoAppOptions) {
    this.options = options;
  }

  static create(options: TerrenoAppOptions): TerrenoApp {
    return new TerrenoApp(options);
  }

  addModelRouter<T>(
    path: string,
    model: Model<T>,
    options: ModelRouterOptions<T> | RESTPermissions<T>
  ): this {
    const routerOptions = isPermissionsObject(options)
      ? ({permissions: options} as ModelRouterOptions<T>)
      : (options as ModelRouterOptions<T>);

    this.pendingModelRouters.push({model, options: routerOptions as ModelRouterOptions<any>, path});
    return this;
  }

  addRoute(path: string, handler: Router | AddRoutesCallback): this {
    this.pendingRoutes.push({handler, path});
    return this;
  }

  addMiddleware(handler: RequestHandler, options?: MiddlewarePosition): this {
    this.pendingMiddleware.push({handler, options});
    return this;
  }

  build(): Express {
    if (this.isBuilt && this.app) {
      return this.app;
    }

    const {auth, logging, middleware, health, openApi, hooks} = this.options;

    // Setup logging
    if (logging) {
      setupLogging(logging);
    }

    // Set env vars from options (for backward compat with auth.ts internals)
    this.setEnvFromOptions();

    const app = express();
    this.app = app;

    // Trust proxy
    const serverOpts = {...defaults.DEFAULT_SERVER_OPTIONS, ...this.options.server};
    if (serverOpts.trustProxy) {
      app.set("trust proxy", serverOpts.trustProxy);
    }

    // Fire onAppCreated hook
    this.runHookSync(hooks, "onAppCreated", app);

    // --- Core middleware ---
    this.setupCoreMiddleware(app, middleware);

    // beforeAuth middleware
    for (const m of this.pendingMiddleware) {
      if (!m.options?.position || m.options.position === "beforeAuth") {
        if (m.options?.path) {
          app.use(m.options.path, m.handler);
        } else {
          app.use(m.handler);
        }
      }
    }

    // Fire onCoreMiddlewareReady hook
    this.runHookSync(hooks, "onCoreMiddlewareReady", app);

    // --- Auth ---
    if (auth.enableAuthRoutes !== false) {
      addAuthRoutes(app, auth.userModel as any, {
        generateJWTPayload: auth.generateJWTPayload,
        generateRefreshTokenExpiration: auth.generateRefreshTokenExpiration,
        generateTokenExpiration: auth.generateTokenExpiration,
      });
    }

    setupAuth(app, auth.userModel as any);

    // afterAuth middleware
    for (const m of this.pendingMiddleware) {
      if (m.options?.position === "afterAuth") {
        if (m.options?.path) {
          app.use(m.options.path, m.handler);
        } else {
          app.use(m.handler);
        }
      }
    }

    // Fire onAuthReady hook
    this.runHookSync(hooks, "onAuthReady", app);

    // --- Request logging ---
    if (logging?.logRequests !== false) {
      app.use(logRequests);
    }

    // Store logging options
    if (logging) {
      app.use((_req, res, next) => {
        res.locals.loggingOptions = logging;
        next();
      });
    }

    // --- Request hook ---
    if (hooks?.onRequest) {
      const onRequest = hooks.onRequest;
      app.use((req, res, next) => {
        Promise.resolve(onRequest(req, res))
          .then(() => next())
          .catch(next);
      });
    }

    // --- Health endpoint ---
    this.setupHealthEndpoint(app, health);

    // --- OpenAPI ---
    const oapi = this.setupOpenApi(app, openApi);

    // --- Me routes ---
    if (auth.enableMeRoute !== false) {
      addMeRoutes(app, auth.userModel as any, {
        generateJWTPayload: auth.generateJWTPayload,
        generateRefreshTokenExpiration: auth.generateRefreshTokenExpiration,
        generateTokenExpiration: auth.generateTokenExpiration,
      });
    }

    // --- Model routers ---
    for (const mr of this.pendingModelRouters) {
      const routerOpts = oapi ? {...mr.options, openApi: oapi} : mr.options;
      app.use(mr.path, modelRouter(mr.model, routerOpts));
    }

    // --- Custom routes ---
    for (const route of this.pendingRoutes) {
      if (typeof route.handler === "function" && !("handle" in route.handler)) {
        const router = express.Router();
        (route.handler as AddRoutesCallback)(router);
        app.use(route.path, router);
      } else {
        app.use(route.path, route.handler as Router);
      }
    }

    // Fire onRoutesReady hook
    this.runHookSync(hooks, "onRoutesReady", app);

    // --- Error handling ---
    app.use(apiUnauthorizedMiddleware);
    app.use(apiErrorMiddleware);

    // Error hook
    if (hooks?.onError) {
      const onError = hooks.onError;
      app.use((err: Error, req: any, res: any, next: any) => {
        Promise.resolve(onError(err, req, res))
          .then(() => next(err))
          .catch(() => next(err));
      });
    }

    // Fallthrough error handler
    app.use((err: any, _req: any, res: any, _next: any) => {
      logger.error(`Fallthrough error: ${err}${err?.stack ? `\n${err.stack}` : ""}`);
      res.status(500).json({status: 500, title: "Internal Server Error"});
    });

    // Fire onReady hook
    this.runHookSync(hooks, "onReady", app);

    this.isBuilt = true;
    return app;
  }

  async start(): Promise<{app: Express; server: Server}> {
    const app = this.build();
    const serverOpts = {...defaults.DEFAULT_SERVER_OPTIONS, ...this.options.server};

    if (serverOpts.skipListen) {
      return {app, server: null as any};
    }

    return new Promise((resolve, reject) => {
      const httpServer = app.listen(serverOpts.port, () => {
        this.server = httpServer;
        logger.info(`Listening on port ${serverOpts.port}`);

        // Setup graceful shutdown
        this.setupShutdown(this.options.shutdown);

        // Fire onListening hook
        if (this.options.hooks?.onListening) {
          Promise.resolve(this.options.hooks.onListening(httpServer, serverOpts.port))
            .then(() => resolve({app, server: httpServer}))
            .catch(reject);
        } else {
          resolve({app, server: httpServer});
        }
      });

      httpServer.on("error", reject);
    });
  }

  getExpressApp(): Express | null {
    return this.app;
  }

  getServer(): Server | null {
    return this.server;
  }

  async shutdown(): Promise<void> {
    if (this.shutdownInProgress) {
      return;
    }
    this.shutdownInProgress = true;

    const shutdownOpts = {...defaults.DEFAULT_SHUTDOWN_OPTIONS, ...this.options.shutdown};

    logger.info("Shutting down gracefully...");

    // Call onShutdown hook
    if (this.options.shutdown?.onShutdown) {
      try {
        await this.options.shutdown.onShutdown();
      } catch (error) {
        logger.error(`Error in onShutdown hook: ${error}`);
      }
    }

    // Close server
    if (this.server) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          logger.warn("Shutdown timeout reached, forcing close");
          resolve();
        }, shutdownOpts.timeout);

        this.server?.close(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    // Remove signal handlers
    for (const {signal, handler} of this.signalHandlers) {
      process.removeListener(signal, handler);
    }
    this.signalHandlers = [];

    this.shutdownInProgress = false;
    logger.info("Shutdown complete");
  }

  private setEnvFromOptions(): void {
    const {auth} = this.options;

    process.env.TOKEN_ISSUER = auth.token.issuer;
    process.env.TOKEN_SECRET = auth.token.secret;
    if (auth.token.expiresIn) {
      process.env.TOKEN_EXPIRES_IN = auth.token.expiresIn;
    }
    if (auth.refreshToken?.secret) {
      process.env.REFRESH_TOKEN_SECRET = auth.refreshToken.secret;
    }
    if (auth.session?.secret) {
      process.env.SESSION_SECRET = auth.session.secret;
    }
  }

  private setupCoreMiddleware(app: Express, middleware?: TerrenoMiddlewareOptions): void {
    // Query parser
    if (middleware?.queryParser !== false) {
      const qpOpts = typeof middleware?.queryParser === "object" ? middleware.queryParser : {};
      if (qpOpts.enabled !== false) {
        app.set("query parser", (str: string) =>
          qs.parse(str, {arrayLimit: qpOpts.arrayLimit ?? 200})
        );
      }
    } else {
      // Default query parser
      app.set("query parser", (str: string) => qs.parse(str, {arrayLimit: 200}));
    }

    // CORS
    if (middleware?.cors !== false) {
      const corsOpts = typeof middleware?.cors === "object" ? middleware.cors : {};
      if (corsOpts.enabled !== false) {
        app.use(
          cors({
            credentials: corsOpts.credentials,
            origin: corsOpts.origin ?? "*",
          })
        );
      }
    } else {
      // Default CORS
      app.use(cors({origin: "*"}));
    }

    // JSON body parsing
    if (middleware?.json !== false) {
      const jsonOpts = typeof middleware?.json === "object" ? middleware.json : {};
      if (jsonOpts.enabled !== false) {
        app.use(express.json({limit: jsonOpts.limit ?? "100kb"}));
      }
    } else {
      app.use(express.json());
    }
  }

  private setupHealthEndpoint(app: Express, health?: HealthOptions): void {
    const healthOpts = {...defaults.DEFAULT_HEALTH_OPTIONS, ...health};
    if (health?.enabled === false) {
      return;
    }

    const path = healthOpts.path;
    const checkFn = health?.check;

    app.get(path, async (_req, res) => {
      if (checkFn) {
        try {
          const result = await checkFn();
          const status = result.healthy ? 200 : 503;
          return res.status(status).json(result);
        } catch (error) {
          return res.status(503).json({
            details: {error: (error as Error).message},
            healthy: false,
          });
        }
      }
      return res.json({healthy: true});
    });
  }

  private setupOpenApi(app: Express, openApiOpts?: TerrenoOpenApiOptions): any {
    const opts = {...defaults.DEFAULT_OPENAPI_OPTIONS, ...openApiOpts};
    if (openApiOpts?.enabled === false) {
      return null;
    }

    app.use(openApiEtagMiddleware);

    const oapi = openapi({
      info: {
        description: opts.info.description,
        title: opts.info.title,
        version: opts.info.version,
      },
      openapi: "3.0.0",
    });
    app.use(oapi);

    if (opts.swagger?.enabled) {
      app.use(opts.swagger.path ?? "/swagger", oapi.swaggerui());
    }

    return oapi;
  }

  private setupShutdown(shutdownOpts?: ShutdownOptions): void {
    const opts = {...defaults.DEFAULT_SHUTDOWN_OPTIONS, ...shutdownOpts};
    if (!opts.handleSignals) {
      return;
    }

    const handler = () => {
      void this.shutdown().then(() => process.exit(0));
    };

    for (const signal of ["SIGTERM", "SIGINT"]) {
      process.on(signal, handler);
      this.signalHandlers.push({handler, signal});
    }
  }

  private runHookSync(hooks: AppHooks | undefined, name: keyof AppHooks, ...args: any[]): void {
    const hook = hooks?.[name];
    if (!hook) {
      return;
    }
    try {
      (hook as (...a: any[]) => any)(...args);
    } catch (error) {
      logger.error(`Error in hook ${name}: ${error}`);
      throw error;
    }
  }
}
