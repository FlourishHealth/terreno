import {DateTime} from "luxon";

import {baseUrl} from "./constants";

interface Queued {
  level: string;
  message: string;
  stack?: string;
  timestamp: string;
}

let queue: Queued[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let restoreConsole: (() => void) | undefined;
let restoreErrorUtils: (() => void) | undefined;

const isDevOrTestInstall = (): boolean => {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    return true;
  }
  if (process.env.TERRENO_DEV_CONSOLE_LOGGER_TEST === "true") {
    return true;
  }
  return false;
};

const flush = async (): Promise<void> => {
  if (queue.length === 0) {
    return;
  }
  const batch = queue;
  queue = [];
  const url = `${baseUrl.replace(/\/$/, "")}/__terreno/browser-logs`;
  try {
    await fetch(url, {
      body: JSON.stringify({entries: batch}),
      headers: {"Content-Type": "application/json"},
      method: "POST",
    });
  } catch {
    // Dev-only bridge; never break the app if the backend is down.
  }
};

const scheduleFlush = (): void => {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    void flush();
  }, 400);
};

const push = (level: string, message: string, stack?: string): void => {
  queue.push({
    level,
    message: message.slice(0, 8000),
    stack,
    timestamp: DateTime.now().toISO(),
  });
  scheduleFlush();
};

/**
 * Test-only teardown: clears timers, restores patched globals, and allows
 * `installTerrenoDevConsoleLogger` to run again. Not exported from package index.
 */
export const resetTerrenoDevConsoleLoggerForTests = (): void => {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }
  flushTimer = undefined;
  queue = [];
  restoreConsole?.();
  restoreConsole = undefined;
  restoreErrorUtils?.();
  restoreErrorUtils = undefined;
  const g = globalThis as typeof globalThis & {__TERRENO_CONSOLE_LOGGER__?: boolean};
  delete g.__TERRENO_CONSOLE_LOGGER__;
};

/**
 * Batches `console.error` / `console.warn`, React Native `ErrorUtils`, and web
 * `window` error hooks to `POST /__terreno/browser-logs` (dev-only backend route).
 */
export const installTerrenoDevConsoleLogger = (): void => {
  if (!isDevOrTestInstall()) {
    return;
  }
  const g = globalThis as typeof globalThis & {__TERRENO_CONSOLE_LOGGER__?: boolean};
  if (g.__TERRENO_CONSOLE_LOGGER__) {
    return;
  }
  g.__TERRENO_CONSOLE_LOGGER__ = true;

  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  restoreConsole = (): void => {
    console.error = origError;
    console.warn = origWarn;
  };
  console.error = (...args: unknown[]): void => {
    push("error", args.map(String).join(" "));
    origError(...args);
  };
  console.warn = (...args: unknown[]): void => {
    push("warn", args.map(String).join(" "));
    origWarn(...args);
  };

  const errorUtils = (globalThis as Record<string, unknown>).ErrorUtils as
    | {
        getGlobalHandler?: () => (error: unknown, isFatal?: boolean) => void;
        setGlobalHandler?: (handler: (error: unknown, isFatal?: boolean) => void) => void;
      }
    | undefined;
  if (errorUtils?.setGlobalHandler) {
    const prev = errorUtils.getGlobalHandler?.();
    errorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      if (error instanceof Error) {
        push("error", error.message, error.stack);
      } else {
        push("error", String(error));
      }
      if (prev) {
        prev(error, isFatal);
      }
    });
    restoreErrorUtils = (): void => {
      if (prev) {
        errorUtils.setGlobalHandler?.(prev);
      }
    };
  }

  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("unhandledrejection", (ev: PromiseRejectionEvent) => {
      push("error", String(ev.reason ?? "unhandledrejection"));
    });
    window.addEventListener("error", (ev: ErrorEvent) => {
      const st = ev.error instanceof Error ? ev.error.stack : undefined;
      push("error", String(ev.message ?? "window.error"), st);
    });
  }
};
