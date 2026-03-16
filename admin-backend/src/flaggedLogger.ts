import {logger} from "@terreno/api";
import type {AdminApp} from "./adminApp";

interface FlaggedLogMeta {
  [key: string]: any;
}

export interface FlaggedLogger {
  debug: (user: any, message: string, meta?: FlaggedLogMeta) => Promise<void>;
  info: (user: any, message: string, meta?: FlaggedLogMeta) => Promise<void>;
  warn: (user: any, message: string, meta?: FlaggedLogMeta) => Promise<void>;
  error: (user: any, message: string, meta?: FlaggedLogMeta) => Promise<void>;
}

export const createFlaggedLogger = (
  adminApp: AdminApp,
  flagKey: string,
  namespace: string
): FlaggedLogger => {
  const log = async (
    level: "debug" | "info" | "warn" | "error",
    user: any,
    message: string,
    meta?: FlaggedLogMeta
  ): Promise<void> => {
    const enabled = await adminApp.boolVariation(flagKey, user, false);
    if (!enabled) {
      return;
    }
    const prefixed = `[${namespace}] ${message}`;
    logger[level](prefixed, meta);
  };

  return {
    debug: (user, message, meta) => log("debug", user, message, meta),
    error: (user, message, meta) => log("error", user, message, meta),
    info: (user, message, meta) => log("info", user, message, meta),
    warn: (user, message, meta) => log("warn", user, message, meta),
  };
};
