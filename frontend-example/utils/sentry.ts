import * as SentryBrowser from "@sentry/react";
import {useEffect} from "react";
import {Platform} from "react-native";
// import {
//   createRoutesFromChildren,
//   matchRoutes,
//   useLocation,
//   useNavigationType,
// } from "react-router-dom";
// import * as SentryNative from "@sentry/react-native";

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
const IGNORE_ERRORS = [
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

// biome-ignore lint/suspicious/noExplicitAny: Sentry types
export const reactNavigationIntegration: any | undefined = IsWeb
  ? undefined
  : undefined;
  // : (SentryNative?.reactNavigationIntegration?.() ?? undefined);

export const setupUnhandledRejectionHandler = (): void => {
  if (IsWeb && typeof window !== "undefined") {
    window.addEventListener("unhandledrejection", (event) => {
      const error = event.reason;
      if (error && typeof error === "object" && "data" in error && "status" in error) {
        // Prevent default handling
        event.preventDefault();
        // Create error message similar to rtkQueryErrorMiddleware pattern
        const errorMessage = error.data?.title ?? error.data?.message ?? JSON.stringify(error.data);
        const message = `Unhandled Promise Rejection (${error.status}): ${errorMessage}`;
        console.warn(message, error);
        // Don't capture 401/404 errors in Sentry
        if (error.status !== 401 && error.status !== 404) {
          captureException(new Error(message));
        }
      }
    });
  } else if (global.ErrorUtils) {
    // React Native handles promise rejections differently through the ErrorUtils global
    const originalHandler = global.ErrorUtils.getGlobalHandler();
    global.ErrorUtils.setGlobalHandler((error: unknown) => {
      if (error && typeof error === "object" && "data" in error && "status" in error) {
        const errorObject = error as {data?: {title?: string; message?: string}};
        const errorMessage =
          errorObject.data?.title ?? errorObject.data?.message ?? JSON.stringify(errorObject.data);
        const message = `Unhandled Promise Rejection (${error.status}): ${errorMessage}`;
        console.warn(message, error);
        if (error.status !== 401 && error.status !== 404) {
          captureException(new Error(message));
        }
      } else if (originalHandler) {
        // Let React Native handle other types of errors
        originalHandler(error);
      }
    });
  }
};

export const sentryInit = (environment: string, debug = false): void => {
  try {
    if (IsWeb) {
      if (SentryBrowser.isInitialized()) {
        console.warn("Sentry already initialized, skipping init");
        return;
      }
      SentryBrowser.init({
        // Don't send events in development
        beforeSend(event) {
          if (process.env.NODE_ENV === "development") {
            return null;
          }
          return event;
        },
        debug,
        dsn: SENTRY_DSN,
        environment,
        integrations: [
          // SentryBrowser.reactRouterV6BrowserTracingIntegration({
          //   // createRoutesFromChildren,
          //   // matchRoutes,
          //   useEffect,
          //   // useLocation,
          //   // useNavigationType,
          // }),
          SentryBrowser.replayIntegration(),
        ],
        replaysOnErrorSampleRate: SENTRY_ERROR_SAMPLE_RATE,
        replaysSessionSampleRate: 0.1,

        // Set `tracePropagationTargets` to control for which URLs trace propagation should be
        // enabled
        tracePropagationTargets: [/https:\/\/api\.flourish\.health.*\//],
        tracesSampleRate: SENTRY_TRACE_SAMPLE_RATE,
      });
    } else {
      // if (!SentryNative) {
      //   throw new Error("@sentry/react-native is not available");
      // }
      // SentryNative.init({
      //   // Don't send events in development
      //   // biome-ignore lint/suspicious/noExplicitAny: Sentry doesn't export this type.
      //   beforeSend(event: any) {
      //     if (process.env.NODE_ENV === "development") {
      //       return null;
      //     }
      //     return event;
      //   },
      //   debug,
      //   dsn: SENTRY_DSN,
      //   enabled: process.env.NODE_ENV === "production",
      //   environment,
      //   ignoreErrors: IGNORE_ERRORS,
      //   integrations: [reactNavigationIntegration],
      //   tracesSampleRate: SENTRY_TRACE_SAMPLE_RATE,
      // });
    }
  } catch (error) {
    captureException(error);
  }
};

export const captureException = (error: unknown | Error): void => {
  if (IsWeb) {
    if (SentryBrowser.isInitialized()) {
      SentryBrowser.captureException(error);
    } else {
      console.error(`Sentry not initialized, captured exception`, error);
    }
  } else {
    // note that Sentry for React Native doesn't have an isInitialized method
    // SentryNative.captureException(error);
  }
};

export const captureEvent = (message: string, extra?: Record<string, string>): void => {
  if (IsWeb) {
    if (SentryBrowser.isInitialized()) {
      SentryBrowser.captureEvent({
        extra,
        level: "debug", // Use 'info' to avoid triggering alerts
        message,
      });
    } else {
      console.error(`Sentry not initialized, captured event`, message, extra);
    }
  } else {
    // note that Sentry for React Native doesn't have an isInitialized method
    // SentryNative.captureEvent({
    //   extra,
    //   level: "debug", // Use 'info' to avoid triggering alerts
    //   message,
    // });
  }
};

export const captureMessage = (message: string, extra?: Record<string, string>): void => {
  if (IsWeb) {
    const scope = new SentryBrowser.Scope();
    for (const [key, value] of Object.entries(extra ?? {})) {
      scope.setExtra(key, value);
    }
    if (SentryBrowser.isInitialized()) {
      SentryBrowser.captureMessage(message, scope);
    } else {
      console.error(`Sentry not initialized, captured message: ${message}`);
    }
  } else {
    // const scope = new SentryNative.Scope();
    // for (const [key, value] of Object.entries(extra ?? {})) {
    //   scope.setExtra(key, value);
    // }
    // // note that Sentry for React Native doesn't have an isInitialized method
    // SentryNative.captureMessage(message, scope);
  }
};

export const pageOnError = (error: Error, stack: unknown): void => {
  console.error("Page Error:", error, stack);
  captureException(error);
};

export const createSentryReduxEnhancer = (): unknown => {
  if (IsWeb) {
    return SentryBrowser.createReduxEnhancer();
  } else {
    // return SentryNative.createReduxEnhancer();
  }
};

export const sentrySetUser = (
  user: {
    _id: string;
    type?: string;
  } | null
): void => {
  if (IsWeb) {
    SentryBrowser.setUser(user);
    SentryBrowser.setTag("userType", user?.type);
  } else {
    // SentryNative.setUser(user);
    // SentryNative.setTag("userType", user?.type);
  }
};
