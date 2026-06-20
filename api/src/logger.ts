/**
 * Backend logging for `@terreno/api`.
 *
 * Three building blocks cooperate so a single request or background job can be followed across
 * many log lines, both in plain-text consoles and in structured transports (Google Cloud Logging,
 * Sentry):
 *
 * - **{@link logger}** – the global logger (`debug` / `info` / `warn` / `error` / `catch`). Use it
 *   for one-off messages.
 * - **{@link createScopedLogger}** – returns a logger that prepends a stable `prefix` and/or
 *   attaches `labels` (workflow dimensions such as `invoiceId`) to every line. Use it when a
 *   handler, job, or service runs multiple steps that should share identifiers.
 * - **{@link createFeatureFlaggedLogger}** – wraps any {@link ScopedLogger} behind an
 *   `isEnabled()` predicate so verbose diagnostics can be toggled with a feature flag or env var
 *   without a redeploy.
 *
 * **Correlation** is automatic: while a request/job AsyncLocalStorage scope is active (see
 * `requestContext.ts` – HTTP middleware or `runWithRequestContext`), every log line is enriched
 * with `requestId`, `userId`, `traceId`, etc. and a nested `terrenoRequestLog` object, regardless
 * of which logger above emitted it.
 *
 * @see {@link createScopedLogger}
 * @see {@link createFeatureFlaggedLogger}
 * @see {@link formatLogContextSuffix}
 * @module logger
 */
import fs from "node:fs";
import {join} from "node:path";
import {inspect} from "node:util";
import * as Sentry from "@sentry/bun";
import winston from "winston";
import {
  getCurrentLogContext,
  getCurrentRequestContext,
  type RequestContext,
} from "./requestContext";

const isPrimitive = (val: unknown) => {
  return val === null || (typeof val !== "object" && typeof val !== "function");
};

const formatWithInspect = (val: unknown) => {
  const prefix = isPrimitive(val) ? "" : "\n";
  const shouldFormat = typeof val !== "string";

  return prefix + (shouldFormat ? inspect(val, {colors: true, depth: null}) : val);
};

const buildTerrenoRequestLog = (active: RequestContext): TerrenoRequestLogEntry => {
  return {
    requestId: active.requestId,
    userId: active.userId ?? null,
  };
};

const mergeActiveRequestIntoInfo = (
  info: winston.Logform.TransformableInfo,
  active: RequestContext
): winston.Logform.TransformableInfo => {
  const next: winston.Logform.TransformableInfo = {
    ...info,
    requestId: active.requestId,
    terrenoRequestLog: buildTerrenoRequestLog(active),
  };
  if (active.jobId) {
    next.jobId = active.jobId;
  }
  if (active.sessionId) {
    next.sessionId = active.sessionId;
  }
  if (active.userId) {
    next.userId = active.userId;
  }
  if (active.spanId) {
    next.spanId = active.spanId;
  }
  if (active.traceId) {
    next.traceId = active.traceId;
  }
  if (active.traceSampled !== undefined) {
    next.traceSampled = active.traceSampled;
  }
  return next;
};

const addRequestContextFormat = winston.format((info) => {
  const active = getCurrentRequestContext();
  if (!active) {
    return {...info};
  }
  return mergeActiveRequestIntoInfo(info, active);
});

/** Always attached to Winston metadata while a request/job ALS scope is active. */
export interface TerrenoRequestLogEntry {
  requestId: string;
  userId: string | null;
}

export interface LogContextFields {
  jobId?: string;
  requestId?: string;
  sessionId?: string;
  terrenoLabels?: Record<string, string>;
  terrenoLogPrefix?: string;
  traceId?: string;
  userId?: string;
}

/**
 * Builds the ` key=value ...` suffix appended to console/file log lines after the message.
 * Request-scoped fields come from AsyncLocalStorage via Winston metadata; `terrenoLabels` and
 * `terrenoLogPrefix` come from {@link createScopedLogger}. Nested `terrenoRequestLog`
 * (`requestId` + `userId` including `null` when anonymous) is attached on the Winston info
 * object for structured transports only, not repeated in this suffix.
 */
export const formatLogContextSuffix = (fields: LogContextFields): string => {
  const contextParts: string[] = [
    fields.requestId ? `requestId=${fields.requestId}` : undefined,
    fields.jobId ? `jobId=${fields.jobId}` : undefined,
    fields.sessionId ? `sessionId=${fields.sessionId}` : undefined,
    fields.userId ? `userId=${fields.userId}` : undefined,
    fields.traceId ? `traceId=${fields.traceId}` : undefined,
    fields.terrenoLogPrefix ? `logPrefix=${fields.terrenoLogPrefix}` : undefined,
  ].filter(Boolean) as string[];

  if (fields.terrenoLabels && typeof fields.terrenoLabels === "object") {
    const sortedKeys = Object.keys(fields.terrenoLabels).sort();
    for (const key of sortedKeys) {
      const value = fields.terrenoLabels[key];
      if (value !== undefined && value !== "") {
        contextParts.push(`${key}=${value}`);
      }
    }
  }

  if (contextParts.length === 0) {
    return "";
  }
  return ` ${contextParts.join(" ")}`;
};

const formatContext = (info: winston.Logform.TransformableInfo): string => {
  return formatLogContextSuffix({
    jobId: info.jobId as string | undefined,
    requestId: info.requestId as string | undefined,
    sessionId: info.sessionId as string | undefined,
    terrenoLabels: info.terrenoLabels as Record<string, string> | undefined,
    terrenoLogPrefix: info.terrenoLogPrefix as string | undefined,
    traceId: info.traceId as string | undefined,
    userId: info.userId as string | undefined,
  });
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


let terrenoDevJsonlAttached = false;

const shouldAttachTerrenoDevJsonl = (): boolean => {
  if (process.env.TERRENO_LOG_FILE === "false" || process.env.TERRENO_LOG_FILE === "0") {
    return false;
  }
  if (process.env.TERRENO_LOG_FILE === "true" || process.env.TERRENO_LOG_FILE === "1") {
    return true;
  }
  return process.env.NODE_ENV !== "production";
};

const attachTerrenoDevJsonlTransportIfEnabled = (
  logger: winston.Logger,
  options?: {disable?: boolean}
): void => {
  if (options?.disable) {
    return;
  }
  if (!shouldAttachTerrenoDevJsonl()) {
    return;
  }
  if (terrenoDevJsonlAttached) {
    return;
  }
  const logDir = join(process.cwd(), ".terreno", "logs");
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, {recursive: true});
  }
  const maxBytes = 5 * 1024 * 1024;
  logger.add(
    new winston.transports.File({
      filename: join(logDir, "app.log"),
      format: winston.format.combine(
        addRequestContextFormat(),
        winston.format.timestamp(),
        winston.format.json()
      ),
      handleExceptions: true,
      handleRejections: true,
      level: "debug",
      maxFiles: 3,
      maxsize: maxBytes,
      options: {flags: "a", mode: 0o600},
    })
  );
  terrenoDevJsonlAttached = true;
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

const mergeSentryLogAttributes = (extra?: Record<string, string>): Record<string, unknown> => {
  const active = getCurrentRequestContext();
  const out: Record<string, unknown> = {...getCurrentLogContext(), ...(extra ?? {})};
  if (active) {
    out.terrenoRequestLog = buildTerrenoRequestLog(active);
  }
  return out;
};

attachTerrenoDevJsonlTransportIfEnabled(winstonLogger);

// Helper function to send logs to Sentry if enabled
const sendToSentry = (
  message: string,
  level: "debug" | "info" | "warn" | "error",
  extraAttributes?: Record<string, string>
): void => {
  if (process.env.USE_SENTRY_LOGGING === "true" && Sentry.logger) {
    const logWithContext = Sentry.logger[level] as (
      message: string,
      attributes?: Record<string, unknown>
    ) => void;
    logWithContext(message, mergeSentryLogAttributes(extraAttributes));
  }
};

/**
 * Global application logger. Each method writes through Winston (console/file transports) and, when
 * `USE_SENTRY_LOGGING=true`, mirrors the line to Sentry with the active request context attached.
 *
 * Prefer {@link createScopedLogger} when a workflow spans multiple log lines that should share a
 * prefix or labels.
 *
 * @example
 * ```typescript
 * import {logger} from "@terreno/api";
 *
 * logger.info("Server started", {port: 4000});
 * logger.warn("Slow query", {ms: 500});
 * logger.error("Failed to process", {error});
 * logger.debug("Request details", {body: req.body});
 *
 * // Convenient `.catch` handler for promises – logs and captures the exception.
 * await chargeCard(id).catch(logger.catch);
 * ```
 */
export const logger = {
  // simple way to log a caught exception. e.g. promise().catch(logger.catch)
  catch: (e: unknown) => {
    const errorMsg = `Caught: ${(e as Error)?.message} ${(e as Error)?.stack}`;
    winstonLogger.error(errorMsg);
    if (process.env.USE_SENTRY_LOGGING === "true") {
      if (e instanceof Error) {
        Sentry.captureException(e);
      } else if (Sentry.logger) {
        Sentry.logger.error(errorMsg, mergeSentryLogAttributes());
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

const normalizeLogLabels = (
  labels?: Record<string, string | number | boolean | undefined>
): Record<string, string> | undefined => {
  if (!labels) {
    return undefined;
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(labels)) {
    if (value === undefined || value === null) {
      continue;
    }
    out[key] = String(value);
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

const applyMessagePrefix = (prefix: string | undefined, msg: string): string => {
  const trimmed = prefix?.trim();
  if (!trimmed) {
    return msg;
  }
  return `${trimmed} ${msg}`;
};

/**
 * Logger-shaped object returned by {@link createScopedLogger} and {@link createFeatureFlaggedLogger}.
 * Method signatures match the global {@link logger} so the three are interchangeable at call sites.
 */
export interface ScopedLogger {
  /** Log a caught exception. Suitable as a promise handler: `promise.catch(log.catch)`. */
  catch: (e: unknown) => void;
  debug: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
  info: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
}

export interface CreateScopedLoggerOptions {
  /** Short, stable token prepended to every message (for grep and log Explorer text search). */
  prefix?: string;
  /**
   * Workflow-specific dimensions merged into Winston metadata as `terrenoLabels` (plain-text
   * suffix and structured jsonPayload on cloud transports). Avoid keys that collide with
   * request context or scoped metadata: requestId, jobId, sessionId, userId, traceId, spanId,
   * terrenoLogPrefix, terrenoRequestLog, terrenoLabels.
   */
  labels?: Record<string, string | number | boolean | undefined>;
}

/** Winston child-logger metadata defaults applied to every line a scoped logger emits. */
interface TerrenoScopedLoggerDefaults {
  terrenoLabels?: Record<string, string>;
  terrenoLogPrefix?: string;
}

const buildScopedLoggerSentryExtras = (
  labels: Record<string, string> | undefined,
  logPrefix: string | undefined
): Record<string, string> | undefined => {
  const out: Record<string, string> = {};
  if (logPrefix) {
    out.terrenoLogPrefix = logPrefix;
  }
  if (labels) {
    for (const [key, value] of Object.entries(labels)) {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

/**
 * Creates a {@link ScopedLogger} that prefixes every message and/or attaches stable `labels` to
 * every line, so multi-step workflows are easy to group and search.
 *
 * - `prefix` is prepended to the human-readable message (easy grep / Log Explorer text search) and
 *   also stored as the Winston metadata field `terrenoLogPrefix`.
 * - `labels` are normalized to strings and stored as the Winston metadata field `terrenoLabels`.
 *   They appear in the plain-text ` key=value` suffix (see {@link formatLogContextSuffix}) and as
 *   discrete fields on structured transports such as `@google-cloud/logging-winston`.
 *
 * Both ride on a Winston **child logger**, so they merge with — and never overwrite — the
 * request/job correlation fields that AsyncLocalStorage injects (`requestId`, `userId`,
 * `terrenoRequestLog`, etc.). Avoid label keys that collide with those framework fields:
 * `requestId`, `jobId`, `sessionId`, `userId`, `traceId`, `spanId`, `terrenoLogPrefix`,
 * `terrenoRequestLog`, `terrenoLabels`.
 *
 * If both `prefix` and `labels` are empty, the global {@link logger} is returned unchanged.
 *
 * @param options - Optional `prefix` token and/or `labels` dimensions for this scope.
 * @returns A scoped logger sharing the same methods as the global {@link logger}.
 * @see {@link createFeatureFlaggedLogger} to gate a scoped logger behind a feature flag.
 *
 * @example Reuse one instance for a whole workflow so every line shares identifiers
 * ```typescript
 * import {createScopedLogger} from "@terreno/api";
 *
 * const log = createScopedLogger({
 *   prefix: "[InvoicePay]",
 *   labels: {invoiceId: invoice._id.toString(), attempt: String(attemptNumber)},
 * });
 *
 * log.info("Starting capture");        // -> "[InvoicePay] Starting capture invoiceId=... attempt=1 requestId=..."
 * log.warn("Stripe rate limited, backing off");
 * await capture(invoice).catch(log.catch);
 * ```
 */
export const createScopedLogger = (options: CreateScopedLoggerOptions = {}): ScopedLogger => {
  const trimmedPrefix = options.prefix?.trim() ? options.prefix.trim() : undefined;
  const terrenoLabels = normalizeLogLabels(options.labels);

  if (!trimmedPrefix && !terrenoLabels) {
    return logger;
  }

  const childDefaults: TerrenoScopedLoggerDefaults = {};
  if (terrenoLabels) {
    childDefaults.terrenoLabels = terrenoLabels;
  }
  if (trimmedPrefix) {
    childDefaults.terrenoLogPrefix = trimmedPrefix;
  }

  const base = winstonLogger.child(childDefaults);
  const sentryExtras = (): Record<string, string> | undefined =>
    buildScopedLoggerSentryExtras(terrenoLabels, trimmedPrefix);

  return {
    catch: (e: unknown) => {
      const errorMsg = applyMessagePrefix(
        trimmedPrefix,
        `Caught: ${(e as Error)?.message} ${(e as Error)?.stack}`
      );
      base.error(errorMsg);
      if (process.env.USE_SENTRY_LOGGING === "true") {
        if (e instanceof Error) {
          Sentry.captureException(e);
        } else if (Sentry.logger) {
          Sentry.logger.error(errorMsg, mergeSentryLogAttributes(sentryExtras()));
        }
      }
    },
    debug: (msg: string, ...args: unknown[]) => {
      const line = applyMessagePrefix(trimmedPrefix, msg);
      base.debug(line, ...args);
      sendToSentry(line, "debug", sentryExtras());
    },
    error: (msg: string, ...args: unknown[]) => {
      const line = applyMessagePrefix(trimmedPrefix, msg);
      base.error(line, ...args);
      sendToSentry(line, "error", sentryExtras());
    },
    info: (msg: string, ...args: unknown[]) => {
      const line = applyMessagePrefix(trimmedPrefix, msg);
      base.info(line, ...args);
      sendToSentry(line, "info", sentryExtras());
    },
    warn: (msg: string, ...args: unknown[]) => {
      const line = applyMessagePrefix(trimmedPrefix, msg);
      base.warn(line, ...args);
      sendToSentry(line, "warn", sentryExtras());
    },
  };
};

export interface CreateFeatureFlaggedLoggerOptions {
  /**
   * When this returns true, log calls are forwarded to `target`. Invoked on every call so flags
   * can flip without process restart (env, database-backed flags, `@terreno/feature-flags`, etc.).
   */
  isEnabled: () => boolean;
  /** Defaults to global `logger`; pass `createScopedLogger({...})` for gated diagnostic blocks. */
  target?: ScopedLogger;
  /**
   * When false (default), `catch` always forwards to `target` so `promise.catch(log.catch)` still
   * records errors when the flag is off. Set true to gate `catch` the same as other levels.
   */
  gateCatch?: boolean;
}

/**
 * Wraps a {@link ScopedLogger} so all `debug` / `info` / `warn` / `error` traffic is dropped while
 * `isEnabled()` returns false. Use it to keep verbose diagnostics in the code but silent until a
 * flag turns them on — no redeploy required.
 *
 * `isEnabled` is evaluated on **every** call, so it can read any feature-flag source: an
 * environment variable, a cached/remote flag map, or a call into `@terreno/feature-flags` from your
 * app. (`@terreno/api` deliberately does not import `@terreno/feature-flags` to avoid a package
 * cycle — you supply the predicate.)
 *
 * @param options - The `isEnabled` predicate plus an optional `target` logger and `gateCatch`.
 * @returns A scoped logger that forwards to `target` only while the flag is enabled.
 * @see {@link createScopedLogger} for the usual `target`.
 *
 * @example Gate a scoped logger behind an env var (flips live, no restart)
 * ```typescript
 * import {createFeatureFlaggedLogger, createScopedLogger} from "@terreno/api";
 *
 * const jobLog = createFeatureFlaggedLogger({
 *   isEnabled: () => process.env.JOB_TRACE_LOGS === "true",
 *   target: createScopedLogger({prefix: "[Job]", labels: {jobName: "nightly-sync"}}),
 * });
 *
 * jobLog.info("step 1"); // silent unless JOB_TRACE_LOGS=true
 * ```
 *
 * @example Drive it from `@terreno/feature-flags` in app code
 * ```typescript
 * const debugLog = createFeatureFlaggedLogger({
 *   isEnabled: () => flags.isEnabled("debug.billing"),
 *   target: createScopedLogger({prefix: "[Billing]"}),
 *   gateCatch: true, // also silence `catch` while the flag is off (default: false)
 * });
 * ```
 */
export const createFeatureFlaggedLogger = (
  options: CreateFeatureFlaggedLoggerOptions
): ScopedLogger => {
  const target = options.target ?? logger;
  const gateCatch = options.gateCatch ?? false;

  return {
    catch: (e: unknown): void => {
      if (gateCatch && !options.isEnabled()) {
        return;
      }
      target.catch(e);
    },
    debug: (msg: string, ...args: unknown[]): void => {
      if (!options.isEnabled()) {
        return;
      }
      target.debug(msg, ...args);
    },
    error: (msg: string, ...args: unknown[]): void => {
      if (!options.isEnabled()) {
        return;
      }
      target.error(msg, ...args);
    },
    info: (msg: string, ...args: unknown[]): void => {
      if (!options.isEnabled()) {
        return;
      }
      target.info(msg, ...args);
    },
    warn: (msg: string, ...args: unknown[]): void => {
      if (!options.isEnabled()) {
        return;
      }
      target.warn(msg, ...args);
    },
  };
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
  /** When true, skips the dev JSONL file under `.terreno/logs/app.log`. */
  disableTerrenoDevJsonlLog?: boolean;
}

export const setupLogging = (options?: LoggingOptions): void => {
  winstonLogger.clear();
  terrenoDevJsonlAttached = false;
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

  attachTerrenoDevJsonlTransportIfEnabled(winstonLogger, {
    disable: options?.disableTerrenoDevJsonlLog === true,
  });
};
