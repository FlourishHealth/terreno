import {setupEnvironment} from "@terreno/api";

export interface TerrenoTestEnvOptions {
  tokenIssuer?: string;
  tokenSecret?: string;
  sessionSecret?: string;
  refreshTokenSecret?: string;
  timezone?: string;
  extra?: Record<string, string | undefined>;
  deleteKeys?: string[];
}

const DEFAULT_AUTH_ENV = {
  REFRESH_TOKEN_SECRET: "refreshTokenSecret",
  SESSION_SECRET: "sessionSecret",
  TOKEN_ISSUER: "terreno.test",
  TOKEN_SECRET: "secret",
} as const;

/**
 * Applies the canonical Terreno backend test `process.env` surface for auth secrets
 * and delegates to `setupEnvironment()` from `@terreno/api`.
 */
export const setTerrenoTestEnv = (options: TerrenoTestEnvOptions = {}): void => {
  process.env.NODE_ENV = "test";
  process.env.TZ = options.timezone ?? "UTC";

  process.env.TOKEN_SECRET = options.tokenSecret ?? DEFAULT_AUTH_ENV.TOKEN_SECRET;
  process.env.TOKEN_ISSUER = options.tokenIssuer ?? DEFAULT_AUTH_ENV.TOKEN_ISSUER;
  process.env.SESSION_SECRET = options.sessionSecret ?? DEFAULT_AUTH_ENV.SESSION_SECRET;
  process.env.REFRESH_TOKEN_SECRET =
    options.refreshTokenSecret ?? DEFAULT_AUTH_ENV.REFRESH_TOKEN_SECRET;

  if (options.extra) {
    for (const [key, value] of Object.entries(options.extra)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
  }

  if (options.deleteKeys) {
    for (const key of options.deleteKeys) {
      Reflect.deleteProperty(process.env, key);
    }
  }

  setupEnvironment();
};
