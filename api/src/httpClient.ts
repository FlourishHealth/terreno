import axios, {type AxiosInstance, type InternalAxiosRequestConfig} from "axios";

import {APIError} from "./errors";
import {logger as defaultLogger} from "./logger";

declare module "axios" {
  export interface AxiosRequestConfig {
    // Opts a non-idempotent request (POST/PUT/PATCH/DELETE) into the retry policy.
    // Callers must be sure the operation is safe to repeat.
    retryUnsafe?: boolean;
  }
}

// Internal per-request state tracked on the axios config across interceptor retries.
interface RetryState {
  __httpClientRetryCount?: number;
  __httpClientDidAuthRefresh?: boolean;
}

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

export type AuthStrategy =
  | {type: "bearer"; getToken: () => Promise<string>}
  | {
      type: "oauth2";
      tokenUrl: string;
      credentials: {clientId: string; clientSecret: string};
      // When true, a 401 response invalidates the cached token and the request is
      // retried once with a freshly fetched token before the failure propagates.
      refreshOn401: boolean;
    }
  | {type: "apiKey"; header: string; getKey: () => Promise<string>};

export interface RetryPolicy {
  // Total attempts including the first request.
  maxAttempts: number;
  retryOn: ApiErrorClassification[];
  // Base for exponential backoff with jitter; a Retry-After response header takes
  // precedence when present and parseable.
  baseDelayMs: number;
}

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  baseDelayMs: 250,
  maxAttempts: 3,
  retryOn: ["rateLimited", "server", "network"],
};

// Retries apply only to these methods unless a request sets `retryUnsafe: true` —
// repeating a failed POST against an external service can duplicate side effects.
const IDEMPOTENT_METHODS = ["get", "head", "options"];

export interface CreateAuthenticatedClientOptions {
  baseURL: string;
  auth: AuthStrategy;
  retry?: Partial<RetryPolicy>;
  logger?: HttpClientLogger;
  // Rewrites the normalized error before it is logged — for consumers with bespoke
  // redaction/classification needs.
  redactError?: (normalized: NormalizedApiError) => NormalizedApiError;
}

export interface AuthenticatedClient {
  axios: AxiosInstance;
  // Drops the cached token so the next request re-authenticates.
  invalidateToken: () => void;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfterMs = (headerValue: unknown): number | undefined => {
  if (typeof headerValue !== "string") {
    return undefined;
  }
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  return undefined;
};

/**
 * Creates an axios instance with a pluggable auth strategy, token caching, and a retry
 * policy for transient failures.
 *
 * Auth: tokens/keys are fetched lazily on the first request and cached on the client;
 * `invalidateToken()` drops the cache. The oauth2 strategy fetches a client-credentials
 * token (HTTP Basic auth, form-encoded `grant_type=client_credentials`) and, with
 * `refreshOn401`, refreshes and retries exactly once when a request returns 401.
 *
 * Retries: failures classified in `retry.retryOn` (default: rateLimited, server,
 * network) are retried with exponential backoff and jitter up to `maxAttempts` total
 * attempts, honoring a parseable Retry-After header. Only idempotent methods
 * (GET/HEAD/OPTIONS) are retried unless the request sets `retryUnsafe: true`.
 *
 * Logging: the client logs retries and token refreshes at debug level only and always
 * rejects with the original axios error — error-level logging is left to the call site
 * (typically via withApiErrorHandling) so composed usage logs each failure exactly once.
 */
export const createAuthenticatedClient = (
  options: CreateAuthenticatedClientOptions
): AuthenticatedClient => {
  const log = options.logger ?? defaultLogger;
  const retryPolicy: RetryPolicy = {...DEFAULT_RETRY_POLICY, ...options.retry};
  let cachedToken: string | undefined;

  const fetchToken = async (): Promise<string> => {
    const {auth} = options;
    if (auth.type === "bearer") {
      return auth.getToken();
    }
    if (auth.type === "apiKey") {
      return auth.getKey();
    }
    const response = await axios.post(
      auth.tokenUrl,
      new URLSearchParams({grant_type: "client_credentials"}),
      {
        auth: {password: auth.credentials.clientSecret, username: auth.credentials.clientId},
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
      }
    );
    return response.data.access_token;
  };

  const getCachedToken = async (): Promise<string> => {
    if (cachedToken === undefined) {
      cachedToken = await fetchToken();
    }
    return cachedToken;
  };

  const instance = axios.create({baseURL: options.baseURL});

  instance.interceptors.request.use(async (config): Promise<InternalAxiosRequestConfig> => {
    const token = await getCachedToken();
    if (options.auth.type === "apiKey") {
      config.headers.set(options.auth.header, token);
    } else {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  });

  instance.interceptors.response.use(undefined, async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config) {
      throw error;
    }
    const config = error.config as InternalAxiosRequestConfig & RetryState;
    let normalized = normalizeApiError(error, {
      apiName: options.baseURL,
      operation: `${config.method ?? "request"} ${config.url ?? ""}`,
    });
    if (options.redactError) {
      normalized = options.redactError(normalized);
    }

    // One-shot token refresh on 401 for oauth2 strategies.
    if (
      options.auth.type === "oauth2" &&
      options.auth.refreshOn401 &&
      error.response?.status === 401 &&
      !config.__httpClientDidAuthRefresh
    ) {
      config.__httpClientDidAuthRefresh = true;
      cachedToken = undefined;
      log.debug(`[httpClient] ${normalized.operation} got 401, refreshing token and retrying`);
      return instance.request(config);
    }

    const method = (config.method ?? "get").toLowerCase();
    const isRetryableMethod = IDEMPOTENT_METHODS.includes(method) || config.retryUnsafe === true;
    const attemptsSoFar = (config.__httpClientRetryCount ?? 0) + 1;
    if (
      !retryPolicy.retryOn.includes(normalized.classification) ||
      !isRetryableMethod ||
      attemptsSoFar >= retryPolicy.maxAttempts
    ) {
      throw error;
    }

    config.__httpClientRetryCount = attemptsSoFar;
    const backoffMs =
      retryPolicy.baseDelayMs * 2 ** (attemptsSoFar - 1) * (1 + Math.random() * 0.5);
    const retryAfterMs = parseRetryAfterMs(error.response?.headers?.["retry-after"]);
    const delayMs = retryAfterMs ?? backoffMs;
    log.debug(
      `[httpClient] ${normalized.operation} failed (${normalized.classification}), ` +
        `retrying attempt ${attemptsSoFar + 1}/${retryPolicy.maxAttempts} in ${Math.round(delayMs)}ms`
    );
    await sleep(delayMs);
    return instance.request(config);
  });

  return {
    axios: instance,
    invalidateToken: (): void => {
      cachedToken = undefined;
    },
  };
};
