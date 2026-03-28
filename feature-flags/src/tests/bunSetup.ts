import {mock} from "bun:test";

// Mock @sentry/bun module
mock.module("@sentry/bun", () => {
  const mockFn = (): ReturnType<typeof mock> => mock(() => {});

  return {
    addBreadcrumb: mockFn(),
    captureException: mockFn(),
    captureMessage: mockFn(),
    close: mock(() => Promise.resolve(true)),
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
    init: mockFn(),
    isInitialized: mock(() => true),
    setContext: mockFn(),
    setTag: mockFn(),
    setUser: mockFn(),
    setupExpressErrorHandler: mockFn(),
    withScope: mock((callback: (scope: unknown) => void) => callback({})),
  };
});
