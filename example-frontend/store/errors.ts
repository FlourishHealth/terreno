import type {Middleware} from "@reduxjs/toolkit";
import * as Sentry from "@sentry/react";
import {captureException} from "@/utils/sentry";

const ignoredErrors = [
  "Account locked due to too many failed login attempts",
  "Password or username is incorrect",
  "User interaction is not allowed",
  "Token refresh failed with 401",
  "Failed to refresh token",
  "Auth and refresh tokens are expired",
  "The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.",
  "Registration failed - permission denied",
  "TypeError: Load failed",
  "TypeError: Failed to fetch",
];

interface RtkRejectedAction {
  error?: boolean;
  payload?: {
    status?: string | number;
    error?: string;
    data?: {
      title?: string;
      message?: string;
      disableExternalErrorTracking?: boolean;
    };
  };
  meta?: {
    baseQueryMeta?: {request?: {method?: string; url?: string}};
    arg?: {
      type?: string;
      endpointName?: string;
      originalArgs?: Record<string, unknown>;
    };
  };
}

/** Log actionable RTK Query errors and send them to Sentry. */
export const rtkQueryErrorMiddleware: Middleware = () => (next) => (action: unknown) => {
  const rejectedAction = action as RtkRejectedAction;
  if (rejectedAction?.error && rejectedAction?.payload) {
    const errorMessage =
      rejectedAction.payload?.data?.title ??
      rejectedAction.payload?.data?.message ??
      rejectedAction.payload?.error ??
      JSON.stringify(rejectedAction.payload);

    let endpointInfo = "unknown endpoint";
    if (
      rejectedAction.meta?.baseQueryMeta?.request?.method &&
      rejectedAction.meta?.baseQueryMeta?.request?.url
    ) {
      endpointInfo = `${rejectedAction.meta.baseQueryMeta.request.url} ${rejectedAction.meta.baseQueryMeta.request.method}`;
    } else if (rejectedAction.meta?.arg?.endpointName) {
      endpointInfo = `${rejectedAction.meta.arg.endpointName} rejected ${rejectedAction.meta.arg.type || ""} `;
    }

    const argsString = rejectedAction.meta?.arg?.originalArgs
      ? JSON.stringify(rejectedAction.meta.arg.originalArgs)
      : "no args";
    const message = `${endpointInfo.trim()}: ${errorMessage} (args: ${argsString})`;
    console.debug(message, JSON.stringify(action));

    if (rejectedAction.payload.status === 404 || rejectedAction.payload.status === 401) {
      return next(action);
    }

    const shouldIgnore =
      ignoredErrors.some((ignoredError) => errorMessage.includes(ignoredError)) ||
      rejectedAction.payload?.data?.disableExternalErrorTracking;
    if (!shouldIgnore) {
      console.warn(`sending data to Sentry: ${message}\n${action}`);
      const error = new Error(message);
      Sentry.withScope((scope: Sentry.Scope) => {
        scope.setContext("request", {
          args: rejectedAction.meta?.arg?.originalArgs,
          endpointInfo,
          fullAction: rejectedAction,
        });
        captureException(error);
      });
    }
  }

  return next(action);
};
