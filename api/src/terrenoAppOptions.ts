import type {Server} from "node:http";
import type {Express, Router} from "express";
import type jwt from "jsonwebtoken";
import type {Model} from "mongoose";

import type {UserModel} from "./auth";
import type {LoggingOptions} from "./logger";

// Re-export for convenience
export type {LoggingOptions};

export type AddRoutesCallback = (router: Router) => void;

export interface TerrenoAuthOptions {
  userModel: Model<any> & UserModel;

  token: {
    issuer: string;
    secret: string;
    expiresIn?: string;
  };

  refreshToken?: {
    secret: string;
    expiresIn?: string;
  };

  session?: {
    secret: string;
  };

  generateJWTPayload?: (user: any) => Record<string, any>;
  generateTokenExpiration?: (user: any) => number | jwt.SignOptions["expiresIn"];
  generateRefreshTokenExpiration?: (user: any) => number | jwt.SignOptions["expiresIn"];

  enableAuthRoutes?: boolean;
  enableMeRoute?: boolean;
}

export interface ServerOptions {
  port?: number;
  skipListen?: boolean;
  trustProxy?: boolean | string;
}

export interface TerrenoMiddlewareOptions {
  cors?:
    | {
        enabled?: boolean;
        origin?: string | string[] | RegExp | boolean;
        credentials?: boolean;
      }
    | false;

  json?:
    | {
        enabled?: boolean;
        limit?: string;
      }
    | false;

  queryParser?:
    | {
        enabled?: boolean;
        arrayLimit?: number;
      }
    | false;
}

export interface HealthCheckResult {
  healthy: boolean;
  details?: Record<string, any>;
}

export interface HealthOptions {
  enabled?: boolean;
  path?: string;
  check?: () => Promise<HealthCheckResult> | HealthCheckResult;
}

export interface TerrenoOpenApiOptions {
  enabled?: boolean;
  path?: string;

  swagger?: {
    enabled?: boolean;
    path?: string;
  };

  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
}

export interface ShutdownOptions {
  handleSignals?: boolean;
  timeout?: number;
  onShutdown?: () => void | Promise<void>;
}

export interface MiddlewarePosition {
  path?: string;
  position?: "beforeAuth" | "afterAuth";
}

export interface AppHooks {
  onAppCreated?: (app: Express) => void | Promise<void>;
  onCoreMiddlewareReady?: (app: Express) => void | Promise<void>;
  onAuthReady?: (app: Express) => void | Promise<void>;
  onRoutesReady?: (app: Express) => void | Promise<void>;
  onReady?: (app: Express) => void | Promise<void>;
  onListening?: (server: Server, port: number) => void | Promise<void>;
  onRequest?: (req: any, res: any) => void | Promise<void>;
  onError?: (error: Error, req: any, res: any) => void | Promise<void>;
}

export interface TerrenoAppOptions {
  auth: TerrenoAuthOptions;
  server?: ServerOptions;
  logging?: LoggingOptions;
  middleware?: TerrenoMiddlewareOptions;
  health?: HealthOptions;
  openApi?: TerrenoOpenApiOptions;
  shutdown?: ShutdownOptions;
  hooks?: AppHooks;
}

export const DEFAULT_SERVER_OPTIONS: Required<ServerOptions> = {
  port: 9000,
  skipListen: false,
  trustProxy: false,
};

export const DEFAULT_HEALTH_OPTIONS: Required<Omit<HealthOptions, "check">> = {
  enabled: true,
  path: "/health",
};

export const DEFAULT_OPENAPI_OPTIONS = {
  enabled: true,
  info: {
    description: "Generated docs from an Express api",
    title: "Express Application",
    version: "1.0.0",
  },
  path: "/openapi.json",
  swagger: {
    enabled: false,
    path: "/swagger",
  },
};

export const DEFAULT_SHUTDOWN_OPTIONS: Required<Omit<ShutdownOptions, "onShutdown">> = {
  handleSignals: true,
  timeout: 30000,
};
