import {afterAll, afterEach, beforeAll, beforeEach, mock} from "bun:test";
import {Writable} from "node:stream";
import mongoose from "mongoose";
import winston from "winston";

import {setupEnvironment} from "../expressServer";
import {logger, winstonLogger} from "../logger";

// Connect to MongoDB once for all tests
beforeAll(async () => {
  await mongoose
    .connect("mongodb://127.0.0.1/terreno?&connectTimeoutMS=360000")
    .catch(logger.catch);
});

// Close MongoDB connection after all tests
afterAll(async () => {
  await mongoose.connection.close();
});

let logs: string[] = [];

const SHOW_ALL_LOGS = process.env.SHOW_ALL_TEST_LOGS === "true";

// Create a custom stream that captures logs
const logStream = new Writable({
  write(chunk: any, _encoding: any, callback: any) {
    logs.push(chunk.toString());
    if (SHOW_ALL_LOGS) {
      process.stdout.write(chunk);
    }
    callback();
  },
});

// Silence both winston loggers by replacing all transports with our capturing stream
const silentTransport = new winston.transports.Stream({
  format: winston.format.simple(),
  stream: logStream,
});

// Clear and silence the default winston logger
winston.clear();
winston.add(silentTransport);

// Clear and silence the custom winstonLogger
winstonLogger.clear();
winstonLogger.add(silentTransport);

// Capture and silence console methods
const originalConsole = {
  debug: console.debug,
  error: console.error,
  info: console.info,
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

// Setup before each test
beforeEach(() => {
  process.env.TOKEN_SECRET = "secret";
  process.env.TOKEN_ISSUER = "terreno-api.test";
  process.env.SESSION_SECRET = "sessionSecret";
  process.env.REFRESH_TOKEN_SECRET = "refreshTokenSecret";
  setupEnvironment();
  // Re-silence loggers after setupEnvironment which may reconfigure them
  winston.clear();
  winston.add(silentTransport);
  winstonLogger.clear();
  winstonLogger.add(silentTransport);
  logs = [];
});

// Clear logs after each test
afterEach(() => {
  logs = [];
});

// Mock @sentry/node module
mock.module("@sentry/node", () => {
  const mockFn = (): ReturnType<typeof mock> => mock(() => {});

  // Mock Scope
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

  // Mock Hub
  const mockClient = {
    captureException: mockFn(),
    captureMessage: mockFn(),
    close: mock(() => Promise.resolve(true)),
    flush: mock(() => Promise.resolve(true)),
    getOptions: mock(() => ({})),
  };

  const mockHub = {
    addBreadcrumb: mockFn(),
    captureException: mockFn(),
    captureMessage: mockFn(),
    configureScope: mockFn(),
    getClient: mock(() => mockClient),
    getScope: mock(() => mockScope),
    popScope: mockFn(),
    pushScope: mockFn(),
    setContext: mockFn(),
    setTag: mockFn(),
    setTags: mockFn(),
    setUser: mockFn(),
    withScope: mockFn(),
  };

  const mockSpan: any = {
    finish: mockFn(),
    setData: mockFn(),
    setStatus: mockFn(),
    setTag: mockFn(),
    startChild: mockFn(),
    toTraceparent: mock(() => "mock-trace-parent"),
  };
  mockSpan.startChild = mock(() => mockSpan);

  const mockTransaction = {
    finish: mockFn(),
    setData: mockFn(),
    setName: mockFn(),
    setStatus: mockFn(),
    setTag: mockFn(),
    startChild: mock(() => mockSpan),
    toTraceparent: mock(() => "mock-trace-parent"),
  };

  return {
    addBreadcrumb: mockFn(),
    captureException: mockFn(),
    captureMessage: mockFn(),
    clearScope: mockFn(),
    close: mock(() => Promise.resolve(true)),
    configureScope: mockFn(),
    default: {
      addBreadcrumb: mockFn(),
      captureException: mockFn(),
      captureMessage: mockFn(),
      clearScope: mockFn(),
      close: mock(() => Promise.resolve(true)),
      configureScope: mockFn(),
      flush: mock(() => Promise.resolve(true)),
      getClient: mock(() => mockClient),
      getCurrentHub: mock(() => mockHub),
      getCurrentScope: mock(() => mockScope),
      Handlers: {
        errorHandler: mock(() => (err: any, _req: any, _res: any, next: any) => next(err)),
        requestHandler: mock(() => (_req: any, _res: any, next: any) => next()),
        tracingHandler: mock(() => (_req: any, _res: any, next: any) => next()),
      },
      init: mockFn(),
      isInitialized: mock(() => true),
      popScope: mockFn(),
      pushScope: mockFn(),
      Severity: {
        Debug: "debug",
        Error: "error",
        Fatal: "fatal",
        Info: "info",
        Warning: "warning",
      } as const,
      setContext: mockFn(),
      setFingerprint: mockFn(),
      setLevel: mockFn(),
      setTag: mockFn(),
      setTags: mockFn(),
      setUser: mockFn(),
      setupExpressErrorHandler: mockFn(),
      startTransaction: mock(() => mockTransaction),
      withScope: mock((callback: any) => callback(mockScope)),
    },
    flush: mock(() => Promise.resolve(true)),
    getClient: mock(() => mockClient),
    getCurrentHub: mock(() => mockHub),
    getCurrentScope: mock(() => mockScope),
    Handlers: {
      errorHandler: mock(() => (err: any, _req: any, _res: any, next: any) => next(err)),
      requestHandler: mock(() => (_req: any, _res: any, next: any) => next()),
      tracingHandler: mock(() => (_req: any, _res: any, next: any) => next()),
    },
    init: mockFn(),
    isInitialized: mock(() => true),
    popScope: mockFn(),
    pushScope: mockFn(),
    Severity: {
      Debug: "debug",
      Error: "error",
      Fatal: "fatal",
      Info: "info",
      Warning: "warning",
    } as const,
    setContext: mockFn(),
    setFingerprint: mockFn(),
    setLevel: mockFn(),
    setTag: mockFn(),
    setTags: mockFn(),
    setUser: mockFn(),
    setupExpressErrorHandler: mockFn(),
    startTransaction: mock(() => mockTransaction),
    withScope: mock((callback: any) => callback(mockScope)),
  };
});
