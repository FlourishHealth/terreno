import axios from "axios";

import {APIError} from "./errors";
import {logger as defaultLogger} from "./logger";

/**
 * Minimal logging surface used by the HTTP client utilities so consumers (and tests)
 * can inject their own logger. Defaults to the terreno logger.
 */
export interface HttpClientLogger {
  debug: (msg: string, ...args: unknown[]) => void;
  warn: (msg: string, ...args: unknown[]) => void;
  error: (msg: string, ...args: unknown[]) => void;
}

/**
 * Machine-readable classification of an external API failure, used to drive retry
 * policies and consistent logging across API clients.
 */
export type ApiErrorClassification =
  | "rateLimited"
  | "unauthorized"
  | "notFound"
  | "validation"
  | "server"
  | "network"
  | "unknown";

export interface NormalizedApiError {
  isAxios: boolean;
  statusCode: number | undefined;
  messages: string[];
  classification: ApiErrorClassification;
  // Context echoed back for structured logging.
  apiName: string;
  operation: string;
}

const classifyStatusCode = (statusCode: number): ApiErrorClassification => {
  if (statusCode === 429) {
    return "rateLimited";
  }
  if (statusCode === 401 || statusCode === 403) {
    return "unauthorized";
  }
  if (statusCode === 404) {
    return "notFound";
  }
  if (statusCode >= 400 && statusCode < 500) {
    return "validation";
  }
  if (statusCode >= 500) {
    return "server";
  }
  return "unknown";
};

// Plain-string bodies (HTML error pages, proxy text) are truncated to this length so an
// unbounded — and potentially sensitive — payload never reaches the logger whole.
const MAX_STRING_BODY_MESSAGE_LENGTH = 500;

/**
 * Extracts human-readable messages from common API error response body shapes:
 * plain strings (truncated), `{message}`, and JSONAPI-style `{errors: [{title, detail}]}`.
 * Returns an empty array when the body has no recognizable message.
 */
const extractBodyMessages = (data: unknown): string[] => {
  if (typeof data === "string" && data.length > 0) {
    if (data.length > MAX_STRING_BODY_MESSAGE_LENGTH) {
      return [`${data.slice(0, MAX_STRING_BODY_MESSAGE_LENGTH)}…`];
    }
    return [data];
  }
  if (data && typeof data === "object") {
    const body = data as {message?: unknown; errors?: unknown};
    if (typeof body.message === "string" && body.message.length > 0) {
      return [body.message];
    }
    if (Array.isArray(body.errors)) {
      const messages: string[] = [];
      for (const entry of body.errors) {
        if (entry && typeof entry === "object") {
          const {title, detail} = entry as {title?: unknown; detail?: unknown};
          if (typeof title === "string" && typeof detail === "string") {
            messages.push(`${title}: ${detail}`);
          } else if (typeof title === "string") {
            messages.push(title);
          } else if (typeof detail === "string") {
            messages.push(detail);
          }
        }
      }
      if (messages.length > 0) {
        return messages;
      }
    }
  }
  return [];
};

/**
 * Normalizes an unknown thrown value from an external API call into a stable shape:
 * status code, human-readable messages, and a machine classification. Axios errors are
 * unwrapped (response body messages extracted); axios errors without a response are
 * classified as "network"; non-axios errors fall through to "unknown" with the error
 * message preserved.
 *
 * Raw payload bodies are not carried on the normalized shape — only recognized message
 * fields are extracted, and plain-string bodies are truncated. Consumers whose services
 * put sensitive data inside those message fields should additionally use a redactError
 * hook.
 */
export const normalizeApiError = (
  error: unknown,
  context: {apiName: string; operation: string}
): NormalizedApiError => {
  const base = {apiName: context.apiName, operation: context.operation};

  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status;
    if (statusCode === undefined) {
      return {
        ...base,
        classification: "network",
        isAxios: true,
        messages: [error.message],
        statusCode: undefined,
      };
    }
    const bodyMessages = extractBodyMessages(error.response?.data);
    return {
      ...base,
      classification: classifyStatusCode(statusCode),
      isAxios: true,
      messages: bodyMessages.length > 0 ? bodyMessages : [error.message],
      statusCode,
    };
  }

  return {
    ...base,
    classification: "unknown",
    isAxios: false,
    messages: [error instanceof Error ? error.message : String(error)],
    statusCode: undefined,
  };
};

export interface WithApiErrorHandlingOptions {
  apiName: string;
  operation: string;
  // "apiError" converts the failure to a terreno APIError suitable for route handlers;
  // "raw" (default) logs the normalized shape and rethrows the original error.
  rethrowAs?: "apiError" | "raw";
  // Rewrites the normalized error before it is logged or converted — for consumers that
  // need to redact service-specific sensitive fields.
  redactError?: (normalized: NormalizedApiError) => NormalizedApiError;
  logger?: HttpClientLogger;
}

/**
 * Wraps an external API call with standardized error handling: failures are normalized
 * via normalizeApiError, passed through the optional redactError hook, logged exactly
 * once, and rethrown.
 *
 * In "raw" mode (default) the wrapper logs the normalized shape via the injected logger
 * and rethrows the original error. In "apiError" mode the wrapper throws a terreno
 * APIError — whose constructor already logs — so the wrapper itself stays silent to
 * preserve the log-once contract. The APIError title is stable per JSONAPI convention;
 * per-occurrence text goes in `detail`, built from the (redacted) normalized messages.
 */
export const withApiErrorHandling = async <T>(
  fn: () => Promise<T>,
  options: WithApiErrorHandlingOptions
): Promise<T> => {
  const log = options.logger ?? defaultLogger;
  try {
    return await fn();
  } catch (error) {
    let normalized = normalizeApiError(error, {
      apiName: options.apiName,
      operation: options.operation,
    });
    if (options.redactError) {
      normalized = options.redactError(normalized);
    }
    if (options.rethrowAs === "apiError") {
      const statusCode = normalized.statusCode;
      throw new APIError({
        detail: normalized.messages[0] ?? "unknown error",
        error,
        meta: {classification: normalized.classification},
        status: statusCode !== undefined && statusCode >= 400 ? statusCode : 500,
        title: `${options.apiName} ${options.operation} request failed`,
      });
    }
    log.error(`[${options.apiName}] ${options.operation} failed`, normalized);
    throw error;
  }
};
