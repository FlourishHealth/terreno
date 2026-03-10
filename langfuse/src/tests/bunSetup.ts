import {afterAll, afterEach, beforeAll, beforeEach, mock} from "bun:test";
import {Writable} from "node:stream";
import {setupEnvironment, winstonLogger} from "@terreno/api";
import mongoose from "mongoose";
import winston from "winston";

beforeAll(async () => {
  await mongoose
    .connect("mongodb://127.0.0.1/terreno-langfuse-test?connectTimeoutMS=360000")
    .catch((err) => {
      console.error("Failed to connect to MongoDB:", err);
    });
});

afterAll(async () => {
  await mongoose.connection.close();
});

let logs: string[] = [];

const SHOW_ALL_LOGS = process.env.SHOW_ALL_TEST_LOGS === "true";

const logStream = new Writable({
  write(chunk: unknown, _encoding: unknown, callback: () => void) {
    logs.push(String(chunk));
    if (SHOW_ALL_LOGS) {
      process.stdout.write(String(chunk));
    }
    callback();
  },
});

const silentTransport = new winston.transports.Stream({
  format: winston.format.simple(),
  stream: logStream,
});

winston.clear();
winston.add(silentTransport);

winstonLogger.clear();
winstonLogger.add(silentTransport);

const originalConsole = {
  debug: console.debug,
  error: console.error,
  info: console.info,
  // biome-ignore lint/suspicious/noConsole: We keep the original reference.
  log: console.log,
  warn: console.warn,
};

const captureConsoleMethod = (method: keyof typeof originalConsole): void => {
  (console as any)[method] = (...args: any[]) => {
    const logMessage = `[console.${method}] ${args.map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg))).join(" ")}`;
    logs.push(logMessage);
    if (SHOW_ALL_LOGS) {
      originalConsole[method](...args);
    }
  };
};

captureConsoleMethod("log");
captureConsoleMethod("info");
captureConsoleMethod("warn");
captureConsoleMethod("error");
captureConsoleMethod("debug");

beforeEach(() => {
  process.env.TOKEN_SECRET = "secret";
  process.env.TOKEN_ISSUER = "terreno-langfuse.test";
  process.env.SESSION_SECRET = "sessionSecret";
  process.env.REFRESH_TOKEN_SECRET = "refreshTokenSecret";
  setupEnvironment();
  winston.clear();
  winston.add(silentTransport);
  winstonLogger.clear();
  winstonLogger.add(silentTransport);
  logs = [];
});

afterEach(() => {
  logs = [];
});

mock.module("@sentry/bun", () => {
  const mockFn = (): ReturnType<typeof mock> => mock(() => {});

  const mockScope = {
    addBreadcrumb: mockFn(),
    clear: mockFn(),
    getSpan: mockFn(),
    setContext: mockFn(),
    setFingerprint: mockFn(),
    setLevel: mockFn(),
    setSpan: mockFn(),
    setTag: mockFn(),
    setTags: mockFn(),
    setTransactionName: mockFn(),
    setUser: mockFn(),
  };

  const mockClient = {
    captureException: mockFn(),
    captureMessage: mockFn(),
    close: mock(() => Promise.resolve(true)),
    flush: mock(() => Promise.resolve(true)),
    getOptions: mock(() => ({})),
  };

  return {
    addBreadcrumb: mockFn(),
    captureException: mockFn(),
    captureMessage: mockFn(),
    clearScope: mockFn(),
    close: mock(() => Promise.resolve(true)),
    configureScope: mockFn(),
    default: {
      captureException: mockFn(),
      captureMessage: mockFn(),
      Handlers: {
        errorHandler: mock(
          () => (err: unknown, _req: unknown, _res: unknown, next: (e?: unknown) => void) =>
            next(err)
        ),
        requestHandler: mock(() => (_req: unknown, _res: unknown, next: () => void) => next()),
        tracingHandler: mock(() => (_req: unknown, _res: unknown, next: () => void) => next()),
      },
      init: mockFn(),
      isInitialized: mock(() => true),
      setupExpressErrorHandler: mockFn(),
    },
    flush: mock(() => Promise.resolve(true)),
    getClient: mock(() => mockClient),
    getCurrentScope: mock(() => mockScope),
    Handlers: {
      errorHandler: mock(
        () => (err: unknown, _req: unknown, _res: unknown, next: (e?: unknown) => void) => next(err)
      ),
      requestHandler: mock(() => (_req: unknown, _res: unknown, next: () => void) => next()),
      tracingHandler: mock(() => (_req: unknown, _res: unknown, next: () => void) => next()),
    },
    init: mockFn(),
    isInitialized: mock(() => true),
    setContext: mockFn(),
    setTag: mockFn(),
    setTags: mockFn(),
    setUser: mockFn(),
    setupExpressErrorHandler: mockFn(),
    withScope: mock((callback: (scope: typeof mockScope) => void) => callback(mockScope)),
  };
});
