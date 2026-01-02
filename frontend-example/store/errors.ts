import type {Middleware} from "@reduxjs/toolkit";
import * as Sentry from "@sentry/react";
import {captureException, captureMessage} from "@utils";
import {useToast} from "ferns-ui";

// Define development check that works in both React Native and web environments
const isDevelopment = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

const ignoredErrors = [
	"Account locked due to too many failed login attempts",
	"Password or username is incorrect",
	"No token found for",
	"User interaction is not allowed",
	"Token refresh failed with 401",
	"Failed to refresh token",
	"Auth and refresh tokens are expired",
	"The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.",
	"Registration failed - permission denied",
	"TypeError: Load failed", // This is something with Safari failing on some preload requests.
	"TypeError: Failed to fetch", // This is a network error from the underlying `fetch`, not an error with the API.
];

/**
 * Log a warning and send error from RTKQuery to Sentry.
 */

// biome-ignore lint/suspicious/noExplicitAny: Generic
export const rtkQueryErrorMiddleware: Middleware = () => (next) => (action: any) => {
	// RTK Query uses `createAsyncThunk` from redux-toolkit under the hood,
	// so we're able to utilize these matchers!
	if (action?.error && action?.payload) {
		// If the APIError title isn't set and it doesn't have a message, send the entire payload to
		// Sentry. Otherwise we get a lot of "undefined"s, which aren't useful.
		// Some of these likely should be ignored.
		const errorMessage =
			action.payload?.data?.title ??
			action.payload?.data?.message ??
			action.payload?.error ??
			JSON.stringify(action.payload);

		// Use baseQueryMeta if available, otherwise fall back to meta.arg
		let endpointInfo = "unknown endpoint";
		if (action.meta?.baseQueryMeta?.request?.method && action.meta?.baseQueryMeta?.request?.url) {
			endpointInfo = `${action.meta.baseQueryMeta.request.url} ${action.meta.baseQueryMeta.request.method}`;
		} else if (action.meta?.arg?.endpointName) {
			endpointInfo = `${action.meta.arg.endpointName} rejected ${action.meta.arg.type || ""} `;
		}

		// Format originalArgs for readability, excluding large objects
		const argsStr = action.meta?.arg?.originalArgs
			? JSON.stringify(action.meta.arg.originalArgs)
			: "no args";

		const message = `${endpointInfo.trim()}: ${errorMessage} (args: ${argsStr})`;
		console.debug(message, JSON.stringify(action));

		// ignore all 'Not Found' (404) and 'Auth Error' (401) errors from showing up in Sentry
		if (action.payload.status === 404 || action.payload.status === 401) {
			return next(action);
		}

		// Ignore some common errors from showing up in Sentry.
		const shouldIgnore =
			ignoredErrors.some((ignoredError) => errorMessage.includes(ignoredError)) ||
			action.payload?.data?.disableExternalErrorTracking;
		if (!shouldIgnore) {
			console.warn(`sending data to Sentry: ${message}\n${action}`);
			const error = new Error(message);
			Sentry.withScope((scope: Sentry.Scope) => {
				scope.setContext("request", {
					args: action.meta?.arg?.originalArgs,
					endpointInfo,
					fullAction: action,
				});
				captureException(error);
			});
		}
	}

	return next(action);
};

/**
 * Log a warning, show an error toast and send error from UI to Sentry.
 */
export const useSentryAndToast = (): ((
	errorMessage: string,
	e?: Error,
	extraInfo?: string
) => void) => {
	const toast = useToast();
	return (error: string, e?: Error, extraInfo?: string): void => {
		if (!error) {
			console.debug("Unable to capture UI error");
			return;
		}

		toast.error(error);

		let warning = `Sending data to Sentry: ${error}`;
		if (e) {
			warning += `\nError: ${e}`;
		}
		if (extraInfo) {
			warning += `\nExtra Info: ${extraInfo}`;
		}

		console.warn(warning);
		captureException(e instanceof Error ? e : new Error(error));
	};
};

/**
 * A function that will throw an error in dev, but only log a warning in prod. In dev,
 * we'll get a stack trace.
 */
export const devError = (message: string): void => {
	if (isDevelopment) {
		// throw new Error(message);
	} else {
		captureMessage(message);
		console.warn(message);
	}
};

export const versionErrorTitleIncluded = (e: unknown, formInstanceId: string): boolean => {
	return (
		(e as {data?: {title?: string}})?.data?.title?.includes(
			`No matching document found for id "${formInstanceId}" version`
		) ?? false
	);
};
