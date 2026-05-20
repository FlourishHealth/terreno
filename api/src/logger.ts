import fs from "node:fs";
import {inspect} from "node:util";
import * as Sentry from "@sentry/bun";
import winston from "winston";
import {getCurrentLogContext} from "./requestContext";

const isPrimitive = (val: unknown) => {
  return val === null || (typeof val !== "object" && typeof val !== "function");
};

const formatWithInspect = (val: unknown) => {
  const prefix = isPrimitive(val) ? "" : "\n";
  const shouldFormat = typeof val !== "string";

  return prefix + (shouldFormat ? inspect(val, {colors: true, depth: null}) : val);
};

const addRequestContextFormat = winston.format((info) => {
  const context = getCurrentLogContext();
  return {...context, ...info};
});

const formatContext = (info: winston.Logform.TransformableInfo): string => {
  const contextParts = [
    info.requestId ? `requestId=${info.requestId}` : undefined,
    info.sessionId ? `sessionId=${info.sessionId}` : undefined,
    info.userId ? `userId=${info.userId}` : undefined,
    info.traceId ? `traceId=${info.traceId}` : undefined,
  ].filter(Boolean);

  if (contextParts.length === 0) {
    return "";
  }
  return ` ${contextParts.join(" ")}`;
};

// Winston doesn't operate like console.log by default, e.g. `logger.error('error',
// error)` only prints the message and no args. Add handling for all the args,
// while also supporting splat logging.
const printf = (timestamp = false) => {
  return (info: winston.Logform.TransformableInfo) => {
    const msg = formatWithInspect(info.message);
    const splatKey = Symbol.for("splat") as unknown as keyof winston.Logform.TransformableInfo;
    const splatArgs = (info[splatKey] || []) as unknown[];
    const rest = splatArgs.map((data) => formatWithInspect(data)).join(" ");
    const context = formatContext(info);
    if (timestamp) {
      return `${info.timestamp} - ${info.level}: ${msg}${context} ${rest}`;
    }
    return `${info.level}: ${msg}${context} ${rest}`;
  };
};

// Setup a global, default rejection handler.
winston.add(
  new winston.transports.Console({
    debugStdout: true,
    format: winston.format.combine(
      addRequestContextFormat(),
      winston.format.colorize(),
      winston.format.simple(),
      winston.format.printf(printf(false))
    ),
    handleExceptions: true,
    handleRejections: true,
    level: "error",
  })
);

// Setup a default console logger.
export const winstonLogger = winston.createLogger({
  format: addRequestContextFormat(),
  level: "debug",
  transports: [
    new winston.transports.Console({
      debugStdout: true,
      format: winston.format.combine(
        addRequestContextFormat(),
        winston.format.colorize(),
        winston.format.simple(),
        winston.format.printf(printf(false))
      ),
      handleExceptions: true,
      handleRejections: true,
      level: "debug",
    }),
  ],
});

// Helper function to send logs to Sentry if enabled
const sendToSentry = (message: string, level: "debug" | "info" | "warn" | "error"): void => {
  if (process.env.USE_SENTRY_LOGGING === "true" && Sentry.logger) {
    Sentry.logger[level](message);
  }
};

export const logger = {
  // simple way to log a caught exception. e.g. promise().catch(logger.catch)
  catch: (e: unknown) => {
    const errorMsg = `Caught: ${(e as Error)?.message} ${(e as Error)?.stack}`;
    winstonLogger.error(errorMsg);
    if (process.env.USE_SENTRY_LOGGING === "true") {
      if (e instanceof Error) {
        Sentry.captureException(e);
      } else if (Sentry.logger) {
        Sentry.logger.error(errorMsg);
      }
    }
  },
  debug: (msg: string, ...args: unknown[]) => {
    winstonLogger.debug(msg, ...args);
    sendToSentry(msg, "debug");
  },
  error: (msg: string, ...args: unknown[]) => {
    winstonLogger.error(msg, ...args);
    sendToSentry(msg, "error");
  },
  info: (msg: string, ...args: unknown[]) => {
    winstonLogger.info(msg, ...args);
    sendToSentry(msg, "info");
  },
  warn: (msg: string, ...args: unknown[]) => {
    winstonLogger.warn(msg, ...args);
    sendToSentry(msg, "warn");
  },
};

export interface LoggingOptions {
  level?: "debug" | "info" | "warn" | "error";
  transports?: winston.transport[];
  disableFileLogging?: boolean;
  disableConsoleLogging?: boolean;
  disableConsoleColors?: boolean;
  showConsoleTimestamps?: boolean;
  logDirectory?: string;
  logRequests?: boolean;
  // Whether to log when requests are slow.
  logSlowRequests?: boolean;
  // The threshold in ms for logging slow requests. Defaults to 200ms for read requests.
  logSlowRequestsReadMs?: number;
  // The threshold in ms for logging slow requests. Defaults to 500ms for write requests.
  logSlowRequestsWriteMs?: number;
}

export const setupLogging = (options?: LoggingOptions): void => {
  winstonLogger.clear();
  if (!options?.disableConsoleLogging) {
    const formats: winston.Logform.Format[] = [addRequestContextFormat(), winston.format.simple()];
    if (!options?.disableConsoleColors) {
      formats.push(winston.format.colorize());
    }
    formats.push(winston.format.printf(printf(options?.showConsoleTimestamps)));
    winstonLogger.add(
      new winston.transports.Console({
        debugStdout: !options?.level || options?.level === "debug",
        format: winston.format.combine(...formats),
        level: options?.level ?? "debug",
      })
    );
  }
  if (!options?.disableFileLogging) {
    const logDirectory = options?.logDirectory ?? "./log";
    if (!fs.existsSync(logDirectory)) {
      fs.mkdirSync(logDirectory, {recursive: true});
    }

    const FILE_LOG_DEFAULTS = {
      colorize: false,
      compress: true,
      dirname: logDirectory,
      format: winston.format.combine(addRequestContextFormat(), winston.format.simple()),
      // 30 days of retention
      maxFiles: 30,
      // 50MB max file size
      maxSize: 1024 * 1024 * 50,
      // Only readable by server user
      options: {mode: 0o600},
    };

    winstonLogger.add(
      new winston.transports.Stream({
        ...FILE_LOG_DEFAULTS,
        handleExceptions: true,
        level: "error",
        // Use stream so we can open log in append mode rather than overwriting.
        stream: fs.createWriteStream("error.log", {flags: "a"}),
      })
    );

    winstonLogger.add(
      new winston.transports.Stream({
        ...FILE_LOG_DEFAULTS,
        level: "info",
        // Use stream so we can open log in append mode rather than overwriting.
        stream: fs.createWriteStream("out.log", {flags: "a"}),
      })
    );
    if (!options?.level || options?.level === "debug") {
      winstonLogger.add(
        new winston.transports.Stream({
          ...FILE_LOG_DEFAULTS,
          level: "debug",
          // Use stream so we can open log in append mode rather than overwriting.
          stream: fs.createWriteStream("debug.log", {flags: "a"}),
        })
      );
    }
  }

  if (options?.transports) {
    for (const transport of options.transports) {
      winstonLogger.add(transport);
    }
  }
};
