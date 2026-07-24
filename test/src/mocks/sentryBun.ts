// noExplicitAny: test mock typing
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {mock} from "bun:test";

/** Registers a global `mock.module("@sentry/bun", ...)` for backend tests. */
export const registerSentryBunMock = (): void => {
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

    const handlers = {
      errorHandler: mock(() => (err: any, _req: any, _res: any, next: any) => next(err)),
      requestHandler: mock(() => (_req: any, _res: any, next: any) => next()),
      tracingHandler: mock(() => (_req: any, _res: any, next: any) => next()),
    };

    const structuredLogger = {
      debug: mockFn(),
      error: mockFn(),
      fatal: mockFn(),
      info: mockFn(),
      trace: mockFn(),
      warn: mockFn(),
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
        Handlers: handlers,
        init: mockFn(),
        isInitialized: mock(() => true),
        logger: structuredLogger,
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
      Handlers: handlers,
      init: mockFn(),
      isInitialized: mock(() => true),
      logger: structuredLogger,
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
};
