// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {afterAll, afterEach, beforeAll, beforeEach, mock} from "bun:test";
import {Writable} from "node:stream";
import {setupEnvironment, winstonLogger} from "@terreno/api";
import mongoose from "mongoose";
import winston from "winston";

const shouldConnectToTestDb = process.env.BUN_TEST_DISABLE_DB !== "true";

// Connect to MongoDB once for all tests
if (shouldConnectToTestDb) {
  beforeAll(async () => {
    await mongoose
      .connect("mongodb://127.0.0.1/terreno-ai-test?&connectTimeoutMS=360000")
      .catch((err) => {
        console.error("Failed to connect to MongoDB:", err);
      });
  });
}

// Close MongoDB connection after all tests
if (shouldConnectToTestDb) {
  afterAll(async () => {
    await mongoose.connection.close();
  });
}

let logs: string[] = [];

const SHOW_ALL_LOGS = process.env.SHOW_ALL_TEST_LOGS === "true";

// Create a custom stream that captures logs
const logStream = new Writable({
  write(chunk: unknown, _encoding: unknown, callback: () => void) {
    logs.push(String(chunk));
    if (SHOW_ALL_LOGS) {
      process.stdout.write(String(chunk));
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

// Setup before each test
beforeEach(() => {
  process.env.TOKEN_SECRET = "secret";
  process.env.TOKEN_ISSUER = "terreno-ai.test";
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

// Mock @langfuse/client globally so the real `./langfuseClient` module runs
// without making network calls. Each `new LangfuseClient(...)` gets its own
// mock functions so tests can customize per-instance behavior (via
// `getLangfuseClient()` after `initLangfuseClient(...)`). Mocking the SDK
// here, rather than mocking `./langfuseClient` per-test-file, prevents the
// `mock.module()` global cache from leaking different shapes across files.
mock.module("@langfuse/client", () => {
  return {
    LangfuseClient: class FakeLangfuseClient {
      baseUrl: string;
      publicKey: string;
      secretKey: string;
      api = {
        prompts: {
          list: mock(async () => ({
            data: [],
            meta: {limit: 20, page: 1, total: 0, totalPages: 0},
          })),
        },
        trace: {
          get: mock(async (id: string) => ({id, name: "Trace"})),
          list: mock(async () => ({
            data: [],
            meta: {limit: 20, page: 1, total: 0, totalPages: 0},
          })),
        },
      };
      prompt = {
        create: mock(async (_params: Record<string, unknown>) => undefined),
        get: mock(async (name: string) => ({
          config: {},
          labels: [],
          name,
          prompt: "",
          tags: [],
          type: "text" as const,
          version: 1,
        })),
      };
      score = {create: mock(() => {})};
      flush = mock(async () => {});
      shutdown = mock(async () => {});

      constructor(opts: {baseUrl: string; publicKey: string; secretKey: string}) {
        this.baseUrl = opts.baseUrl;
        this.publicKey = opts.publicKey;
        this.secretKey = opts.secretKey;
      }
    },
  };
});

// Ensure no langfuse client instance leaks across tests in different files.
// The real langfuseInstance module variable is reset to null between tests.
beforeEach(async () => {
  const {shutdownLangfuseClient} = await import("../langfuseClient");
  await shutdownLangfuseClient();
});

// Mock @sentry/bun module
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
