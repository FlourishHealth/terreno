// https://jsonapi.org/format/#errors
import * as Sentry from "@sentry/bun";
import type {NextFunction, Request, Response} from "express";
import mongoose, {Schema} from "mongoose";

import {logger} from "./logger";

export interface APIErrorConstructor {
  // Required. A short, human-readable summary of the problem that SHOULD NOT change from
  // occurrence to occurrence of the problem, except for purposes of localization.
  title: string;

  // error messages to be displayed by a field in a form. this isn't in the JSONAPI spec.
  // It will be folded into `meta` as `meta.fields` in the actual error payload.
  // This is helpful to add it to the TS interface for ApiError.
  fields?: {[id: string]: string};

  // A unique identifier for this particular occurrence of the problem.
  id?: string;
  // A links object containing the following members:
  links?: {about?: string; type?: string} | undefined;
  // The HTTP status code applicable to this problem. defaults to 500. must be between 400 and 599.
  status?: number;
  // An application-specific error code, expressed as a string value.
  code?: string;

  // A human-readable explanation specific to this occurrence of the problem. Like title,
  // this field’s value can be localized.
  detail?: string;
  // An object containing references to the source of the error,
  // optionally including any of the following members:
  source?: {
    // pointer: a JSON Pointer [RFC6901] to the value in the request document that caused the error
    // [e.g. "/data" for a primary data object, or "/data/attributes/title" for a specific
    // attribute]. This MUST point to a value in the request document that exists; if it doesn’t,
    // the client SHOULD simply ignore the pointer.
    pointer?: string;
    // a string indicating which URI query parameter caused the error.
    parameter?: string;
    // a string indicating the name of a single request header which caused the error.
    header?: string;
  };
  // A meta object containing non-standard meta-information about the error.
  meta?: {[id: string]: string};
  error?: unknown;
  // If true, this error will not be sent to external error reporting tools like Sentry.
  disableExternalErrorTracking?: boolean;
}

/**
 * APIError is a simple way to throw an error in an API route and control what is shown and the
 * HTTP code displayed. It follows the JSONAPI spec to standardize the fields,
 * allowing the UI to show more consistent, better error messages.
 *
 * ```ts
 *  throw new APIError({
 *    title: "Only an admin can update that!",
 *    status: 403,
 *    code: "update-admin-error",
 *    detail: "You must be an admin to change that field"
 *  });
 * ```
 */
export class APIError extends Error {
  title: string;

  id: string | undefined;

  links: {about?: string; type?: string} | undefined;

  status: number;

  code: string | undefined;

  detail: string | undefined;

  source:
    | {
        pointer?: string;
        parameter?: string;
        header?: string;
      }
    | undefined;

  meta: {[id: string]: unknown} | undefined;

  error?: unknown;

  disableExternalErrorTracking?: boolean;

  constructor(data: APIErrorConstructor) {
    const errorStack =
      data.error instanceof Error && data.error.stack ? `\n${data.error.stack}` : "";
    // Include details in when the error is printed to the console or sent to Sentry.
    super(`${data.title}${data.detail ? `: ${data.detail}` : ""}${errorStack}`);
    this.name = "APIError";

    let {title, id, links, status, code, detail, source, meta, fields, error} = data;

    if (!status) {
      status = 500;
    } else if (status && (status < 400 || status > 599)) {
      logger.error(`Invalid ApiError status code: ${status}, using 500`);
      status = 500;
    }
    this.status = status;

    this.title = title;
    this.id = id;
    this.links = links;

    this.code = code;
    this.detail = detail;
    this.source = source;
    this.meta = meta ?? {};
    this.disableExternalErrorTracking = data.disableExternalErrorTracking;
    if (fields) {
      this.meta.fields = fields;
    }
    this.error = error;
    const dataErrorStack =
      data.error instanceof Error && data.error.stack ? `\n${data.error.stack}` : "";
    const logMessage = `APIError(${status}): ${title} ${detail ? detail : ""}${dataErrorStack}`;
    if (data.disableExternalErrorTracking) {
      logger.warn(logMessage);
    } else {
      logger.error(logMessage);
    }
  }
}

// This can be attached to any schema to store errors compatible with the JSONAPI spec.
// Lazily initialize to avoid module loading order issues with Bun where mongoose
// may not be fully initialized when this module loads.

// Create an errors field for storing error information in a JSONAPI compatible form directly on a
// model.
export const errorsPlugin = (schema: Schema): void => {
  const errorSchema = new Schema({
    code: {description: "Application-specific error code", type: String},
    detail: {description: "Human-readable explanation of the error", type: String},
    id: {description: "Unique identifier for this error occurrence", type: String},
    links: {
      about: {description: "Link to documentation about this error", type: String},
      type: {description: "Link describing the error type", type: String},
    },
    meta: {description: "Non-standard meta information about the error", type: Schema.Types.Mixed},
    source: {
      header: {description: "HTTP header that caused the error", type: String},
      parameter: {description: "Query parameter that caused the error", type: String},
      pointer: {
        description: "JSON pointer to the request field that caused the error",
        type: String,
      },
    },
    status: {description: "HTTP status code for this error", type: Number},
    title: {description: "Short summary of the error", required: true, type: String},
  });

  schema.add({apiErrors: errorSchema});
};

export const isAPIError = (error: unknown): error is APIError => {
  return error instanceof Error && error.name === "APIError";
};

/** Extract a human-readable message from an unknown error. */
export const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

/** Extract a stack trace string from an unknown error. */
export const errorStack = (error: unknown): string => {
  if (error instanceof Error && error.stack) {
    return error.stack;
  }
  return String(error);
};

/**
 * Safely extracts the disableExternalErrorTracking property from an error.
 * Works with both APIError instances and regular Error objects that may have
 * this property attached.
 */
export const getDisableExternalErrorTracking = (error: unknown): boolean | undefined => {
  if (error instanceof Error) {
    if (isAPIError(error)) {
      return error.disableExternalErrorTracking;
    }
  }
  if (error && typeof error === "object" && "disableExternalErrorTracking" in error) {
    return (error as {disableExternalErrorTracking?: boolean}).disableExternalErrorTracking;
  }
  return undefined;
};

// Creates an APIError body to send to clients as JSON. Errors don't have a toJSON defined,
// and we want to strip out things like message, name, and stack for the client.
// There is almost certainly a more elegant solution to this.
export const getAPIErrorBody = (error: APIError): Record<string, unknown> => {
  const errorData: Record<string, unknown> = {status: error.status, title: error.title};
  const indexable = error as unknown as Record<string, unknown>;
  for (const key of [
    "id",
    "links",
    "status",
    "code",
    "detail",
    "source",
    "meta",
    "disableExternalErrorTracking",
  ]) {
    if (indexable[key]) {
      errorData[key] = indexable[key];
    }
  }
  return errorData;
};

export const apiUnauthorizedMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err.message === "Unauthorized") {
    // not using the actual APIError class here because we don't want to log it as an error.
    res.status(401).json({status: 401, title: "Unauthorized"}).send();
  } else {
    next(err);
  }
};

/**
 * Converts Mongoose validation/cast errors into client-friendly APIErrors.
 */
export const mongooseErrorToAPIError = (err: Error): APIError | null => {
  if (err instanceof mongoose.Error.ValidationError) {
    const fields: {[id: string]: string} = {};
    for (const [path, subErr] of Object.entries(err.errors)) {
      fields[path] = subErr.message;
    }
    return new APIError({
      detail: err.message,
      disableExternalErrorTracking: true,
      fields,
      status: 400,
      title: "Validation failed",
    });
  }

  if (err instanceof mongoose.Error.CastError) {
    const path = err.path ?? "field";
    return new APIError({
      detail: `Invalid value for ${path}`,
      disableExternalErrorTracking: true,
      fields: {
        [path]: `Expected ${err.kind ?? "a valid value"}, got ${JSON.stringify(err.value)}`,
      },
      status: 400,
      title: "Validation failed",
    });
  }

  return null;
};

export const apiErrorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (isAPIError(err)) {
    if (!err.disableExternalErrorTracking) {
      Sentry.captureException(err);
    }
    res.status(err.status).json(getAPIErrorBody(err)).send();
    return;
  }

  const mongooseError = mongooseErrorToAPIError(err);
  if (mongooseError) {
    res.status(mongooseError.status).json(getAPIErrorBody(mongooseError)).send();
    return;
  }

  next(err);
};

/**
 * Final Express error handler for unexpected errors. Always returns JSON so
 * clients (e.g. RTK Query) can parse the response.
 */
export const apiFallthroughErrorMiddleware = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error(`Fallthrough error: ${err}${err.stack ? `\n${err.stack}` : ""}`);
  Sentry.captureException(err);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({status: 500, title: "Internal server error"}).send();
};
