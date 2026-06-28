import * as Sentry from "@sentry/react";
import {Platform} from "react-native";

const IsWeb = Platform.OS === "web";

// Add type declaration for React Native's ErrorUtils
declare const global: {
  ErrorUtils: {
    setGlobalHandler(callback: (error: unknown, isFatal?: boolean) => void): void;
    getGlobalHandler(): ((error: unknown, isFatal?: boolean) => void) | undefined;
  };
};

const SENTRY_DSN = "";
const SENTRY_TRACE_SAMPLE_RATE = 0.1;
const SENTRY_ERROR_SAMPLE_RATE = 1.0;
const _IGNORE_ERRORS = [
  /^.*Network request failed.*$/,
  /^.*Network Error*$/,
  /^.*Cannot complete operation because sound is not loaded.*$/,
  /^.*NotAllowedError: play\(\) failed because the user didn't interact with the document first.*$/,
  /^.*The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.*$/,
  /^.*FETCH_ERROR*$/,
  /^.*Job was cancelled.*$/,
  /^.*_malloc is not defined*$/,
  /^.*Zn is not a function*$/,
];

// biome-ignore lint/suspicious/noExplicitAny: Sentry types vary across versions
export const reactNavigationIntegration: any | undefined = undefined;

export const setupUnhandledRejectionHandler = (): void => {
  if (IsWeb && typeof window !== "undefined") {
    window.addEventListener("unhandledrejection", (event) => {
      const error = event.reason;
      if (error && typeof error === "object" && "data" in error && "status" in error) {
        event.preventDefault();
        const errorMessage = error.data?.title ?? error.data?.message ?? JSON.stringify(error.data);
        const message = `Unhandled Promise Rejection (${error.status}): ${errorMessage}`;
        console.warn(message, error);
        if (error.status !== 401 && error.status !== 404) {
          captureException(new Error(message));
        }
      }
    });
  } else if (global?.ErrorUtils) {
    const originalHandler = global.ErrorUtils.getGlobalHandler();
    global.ErrorUtils.setGlobalHandler((error: unknown) => {
      if (error && typeof error === "object" && "data" in error && "status" in error) {
        const errorObject = error as {data?: {title?: string; message?: string}; status?: number};
        const errorMessage =
          errorObject.data?.title ?? errorObject.data?.message ?? JSON.stringify(errorObject.data);
        const message = `Unhandled Promise Rejection (${errorObject.status}): ${errorMessage}`;
        console.warn(message, error);
        if (errorObject.status !== 401 && errorObject.status !== 404) {
          captureException(new Error(message));
        }
      } else if (originalHandler) {
        originalHandler(error);
      }
    });
  }
};

export const sentryInit = (environment: string, debug = false): void => {
  try {
    if (!IsWeb) {
      // @sentry/react-native requires a custom dev build with native modules.
      // Skip initialization when running in Expo Go.
      return;
    }

    if (Sentry.isInitialized()) {
      console.warn("Sentry already initialized, skipping init");
      return;
    }
    Sentry.init({
      beforeSend(event) {
        if (process.env.NODE_ENV === "development") {
          return null;
        }
        return event;
      },
      debug,
      dsn: SENTRY_DSN,
      environment,
      integrations: [Sentry.replayIntegration()],
      replaysOnErrorSampleRate: SENTRY_ERROR_SAMPLE_RATE,
      replaysSessionSampleRate: 0.1,
      tracePropagationTargets: [/https:\/\/api\.flourish\.health.*\//],
      tracesSampleRate: SENTRY_TRACE_SAMPLE_RATE,
    });
  } catch (error) {
    captureException(error);
  }
};

export const captureException = (error: unknown | Error): void => {
  if (!IsWeb) {
    return;
  }
  if (Sentry.isInitialized()) {
    Sentry.captureException(error);
  } else {
    console.error(`Sentry not initialized, captured exception`, error);
  }
};

export const captureEvent = (message: string, extra?: Record<string, string>): void => {
  if (!IsWeb) {
    return;
  }
  if (Sentry.isInitialized()) {
    Sentry.captureEvent({
      extra,
      level: "debug",
      message,
    });
  } else {
    console.error(`Sentry not initialized, captured event`, message, extra);
  }
};

export const captureMessage = (message: string, extra?: Record<string, string>): void => {
  if (!IsWeb) {
    return;
  }
  const scope = new Sentry.Scope();
  for (const [key, value] of Object.entries(extra ?? {})) {
    scope.setExtra(key, value);
  }
  if (Sentry.isInitialized()) {
    Sentry.captureMessage(message, scope);
  } else {
    console.error(`Sentry not initialized, captured message: ${message}`);
  }
};

export const pageOnError = (error: Error, stack: unknown): void => {
  console.error("Page Error:", error, stack);
  captureException(error);
};

export const createSentryReduxEnhancer = (): unknown => {
  if (IsWeb && typeof Sentry.createReduxEnhancer === "function") {
    return Sentry.createReduxEnhancer();
  }

  return (next: unknown) => next;
};

export const sentrySetUser = (
  user: {
    _id: string;
    type?: string;
  } | null
): void => {
  if (!IsWeb) {
    return;
  }
  Sentry.setUser(user);
  Sentry.setTag("userType", user?.type);
};
