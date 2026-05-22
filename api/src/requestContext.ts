import {AsyncLocalStorage} from "node:async_hooks";
import {randomUUID} from "node:crypto";
import * as Sentry from "@sentry/bun";
import type express from "express";
import type {JwtPayload} from "jsonwebtoken";

const CLOUD_TRACE_CONTEXT_HEADER = "x-cloud-trace-context";
const JOB_ID_HEADER = "x-job-id";
const REQUEST_ID_HEADERS = ["x-request-id", "x-correlation-id", "x-transaction-id"];
const SESSION_ID_HEADER = "x-session-id";
const SPAN_ID_HEADER = "x-span-id";
const TRACE_ID_HEADER = "x-trace-id";
const TRACE_PARENT_HEADER = "traceparent";
const TRACE_SAMPLED_HEADER = "x-trace-sampled";
const USER_ID_HEADER = "x-user-id";

export interface RequestContext {
  jobId?: string;
  requestId: string;
  sessionId?: string;
  spanId?: string;
  traceId?: string;
  traceSampled?: boolean;
  userId?: string;
}

export type RequestContextAttributes = Record<string, string>;

export const REQUEST_CONTEXT_ATTRIBUTE_NAMES = {
  jobId: JOB_ID_HEADER,
  requestId: "x-request-id",
  sessionId: SESSION_ID_HEADER,
  spanId: SPAN_ID_HEADER,
  traceId: TRACE_ID_HEADER,
  traceParent: TRACE_PARENT_HEADER,
  traceSampled: TRACE_SAMPLED_HEADER,
  userId: USER_ID_HEADER,
} as const;

interface GoogleCloudTraceContext {
  spanId?: string;
  traceId?: string;
  traceSampled?: boolean;
}

export interface JwtSessionPayload extends JwtPayload {
  sid?: string;
  sessionId?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

const getHeader = (req: express.Request, headerName: string): string | undefined => {
  const value = req.header(headerName);
  if (!Array.isArray(value)) {
    return value;
  }
  return value[0];
};

const parseGoogleCloudTraceContext = (
  headerValue?: string
): GoogleCloudTraceContext | undefined => {
  if (!headerValue) {
    return undefined;
  }

  const [traceAndSpan, options] = headerValue.split(";");
  const [traceId, spanId] = traceAndSpan.split("/");
  if (!traceId) {
    return undefined;
  }

  return {
    spanId,
    traceId,
    traceSampled: options === "o=1",
  };
};

const parseTraceParent = (headerValue?: string): GoogleCloudTraceContext | undefined => {
  if (!headerValue) {
    return undefined;
  }

  const [_version, traceId, spanId, flags] = headerValue.split("-");
  if (!traceId) {
    return undefined;
  }

  return {
    spanId,
    traceId,
    traceSampled: flags === "01",
  };
};

const parseTraceSampled = (value?: string | boolean): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  if (value === "true" || value === "1") {
    return true;
  }
  if (value === "false" || value === "0") {
    return false;
  }
  return undefined;
};

const getIncomingRequestId = (
  req: express.Request,
  traceContext?: GoogleCloudTraceContext
): string => {
  for (const headerName of REQUEST_ID_HEADERS) {
    const headerValue = getHeader(req, headerName);
    if (headerValue) {
      return headerValue;
    }
  }

  if (traceContext?.traceId) {
    return traceContext.traceId;
  }

  return randomUUID();
};

export const getSessionIdFromJwtPayload = (
  payload?: JwtSessionPayload | null
): string | undefined => {
  if (!payload) {
    return undefined;
  }
  if (payload.sid) {
    return payload.sid;
  }
  return payload.sessionId;
};

export const getRequestContextFromAttributes = (
  attributes: Record<string, string | undefined> = {}
): RequestContext => {
  const cloudTraceContext = parseGoogleCloudTraceContext(attributes[CLOUD_TRACE_CONTEXT_HEADER]);
  const traceParentContext = parseTraceParent(attributes[TRACE_PARENT_HEADER]);
  const traceContext = cloudTraceContext ?? traceParentContext;

  return {
    jobId: attributes[JOB_ID_HEADER],
    requestId:
      attributes[REQUEST_CONTEXT_ATTRIBUTE_NAMES.requestId] ??
      attributes["x-correlation-id"] ??
      attributes["x-transaction-id"] ??
      traceContext?.traceId ??
      randomUUID(),
    sessionId: attributes[SESSION_ID_HEADER],
    spanId: attributes[SPAN_ID_HEADER] ?? traceContext?.spanId,
    traceId: attributes[TRACE_ID_HEADER] ?? traceContext?.traceId,
    traceSampled: parseTraceSampled(attributes[TRACE_SAMPLED_HEADER]) ?? traceContext?.traceSampled,
    userId: attributes[USER_ID_HEADER],
  };
};

export const getCurrentRequestContext = (): RequestContext | undefined => {
  return requestContextStorage.getStore();
};

export const getCurrentLogContext = (): Partial<RequestContext> => {
  const context = getCurrentRequestContext();
  if (!context) {
    return {};
  }

  return {
    jobId: context.jobId,
    requestId: context.requestId,
    sessionId: context.sessionId,
    spanId: context.spanId,
    traceId: context.traceId,
    traceSampled: context.traceSampled,
    userId: context.userId,
  };
};

const setSentryTag = (
  scope: ReturnType<typeof Sentry.getCurrentScope>,
  name: string,
  value?: string | boolean
): void => {
  if (typeof value === "undefined") {
    return;
  }
  scope.setTag(name, String(value));
};

const setSentryContextValue = (
  context: Record<string, string | boolean>,
  name: string,
  value?: string | boolean
): void => {
  if (typeof value === "undefined") {
    return;
  }
  context[name] = value;
};

export const applyRequestContextToSentry = (
  context: Partial<RequestContext> = getCurrentLogContext()
): void => {
  const scope = Sentry.getCurrentScope();
  setSentryTag(scope, "request_id", context.requestId);
  setSentryTag(scope, "session_id", context.sessionId);
  setSentryTag(scope, "job_id", context.jobId);
  setSentryTag(scope, "user_id", context.userId);
  setSentryTag(scope, "trace_id", context.traceId);
  setSentryTag(scope, "span_id", context.spanId);
  setSentryTag(scope, "trace_sampled", context.traceSampled);

  if (context.userId) {
    scope.setUser({id: context.userId});
  }

  const sentryContext: Record<string, string | boolean> = {};
  setSentryContextValue(sentryContext, "requestId", context.requestId);
  setSentryContextValue(sentryContext, "sessionId", context.sessionId);
  setSentryContextValue(sentryContext, "jobId", context.jobId);
  setSentryContextValue(sentryContext, "userId", context.userId);
  setSentryContextValue(sentryContext, "traceId", context.traceId);
  setSentryContextValue(sentryContext, "spanId", context.spanId);
  setSentryContextValue(sentryContext, "traceSampled", context.traceSampled);

  if (Object.keys(sentryContext).length > 0) {
    scope.setContext("request_context", sentryContext);
  }
};

export const setRequestContext = (updates: Partial<RequestContext>): void => {
  const context = getCurrentRequestContext();
  if (!context) {
    return;
  }
  Object.assign(context, updates);
  applyRequestContextToSentry(context);
};

const setAttribute = (
  attributes: RequestContextAttributes,
  name: string,
  value?: string | boolean
): void => {
  if (typeof value === "undefined") {
    return;
  }
  attributes[name] = String(value);
};

export const getCurrentRequestContextAttributes = (
  overrides: Partial<RequestContext> = {}
): RequestContextAttributes => {
  const context = {...getCurrentLogContext(), ...overrides};
  const attributes: RequestContextAttributes = {};
  setAttribute(attributes, REQUEST_CONTEXT_ATTRIBUTE_NAMES.requestId, context.requestId);
  setAttribute(attributes, REQUEST_CONTEXT_ATTRIBUTE_NAMES.sessionId, context.sessionId);
  setAttribute(attributes, REQUEST_CONTEXT_ATTRIBUTE_NAMES.jobId, context.jobId);
  setAttribute(attributes, REQUEST_CONTEXT_ATTRIBUTE_NAMES.userId, context.userId);
  setAttribute(attributes, REQUEST_CONTEXT_ATTRIBUTE_NAMES.traceId, context.traceId);
  setAttribute(attributes, REQUEST_CONTEXT_ATTRIBUTE_NAMES.spanId, context.spanId);
  setAttribute(attributes, REQUEST_CONTEXT_ATTRIBUTE_NAMES.traceSampled, context.traceSampled);
  return attributes;
};

export const runWithRequestContext = <T>(
  context: Partial<RequestContext>,
  callback: () => T
): T => {
  const nextContext = {
    ...context,
    requestId: context.requestId ?? randomUUID(),
  };

  return requestContextStorage.run(nextContext, () => {
    applyRequestContextToSentry(nextContext);
    return callback();
  });
};

export const runWithRequestContextAttributes = <T>(
  attributes: Record<string, string | undefined> = {},
  callback: () => T
): T => {
  return runWithRequestContext(getRequestContextFromAttributes(attributes), callback);
};

export const updateRequestContextFromRequest = (
  req: express.Request,
  res?: express.Response
): void => {
  const reqWithContext = req as express.Request & {
    authTokenPayload?: JwtSessionPayload;
    betterAuthSession?: {session?: {id?: string}};
    jobId?: string;
    requestId?: string;
    sessionId?: string;
  };
  const jobId = reqWithContext.jobId ?? getHeader(req, JOB_ID_HEADER);
  const sessionId =
    getSessionIdFromJwtPayload(reqWithContext.authTokenPayload) ??
    reqWithContext.betterAuthSession?.session?.id ??
    reqWithContext.sessionId ??
    getHeader(req, SESSION_ID_HEADER);
  const user = req.user as {_id?: unknown; id?: string} | undefined;
  const userId = user?.id ?? (user?._id ? String(user._id) : undefined);

  setRequestContext({jobId, sessionId, userId});

  if (jobId) {
    reqWithContext.jobId = jobId;
    res?.setHeader("X-Job-ID", jobId);
  }

  if (sessionId) {
    reqWithContext.sessionId = sessionId;
    res?.setHeader("X-Session-ID", sessionId);
  }
};

export const requestContextMiddleware = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void => {
  const cloudTraceContext = parseGoogleCloudTraceContext(
    getHeader(req, CLOUD_TRACE_CONTEXT_HEADER)
  );
  const traceParentContext = parseTraceParent(getHeader(req, TRACE_PARENT_HEADER));
  const traceContext = cloudTraceContext ?? traceParentContext;
  const requestId = getIncomingRequestId(req, traceContext);
  const jobId = getHeader(req, JOB_ID_HEADER);
  const sessionId = getHeader(req, SESSION_ID_HEADER);

  const context: RequestContext = {
    jobId,
    requestId,
    sessionId,
    spanId: traceContext?.spanId,
    traceId: traceContext?.traceId,
    traceSampled: traceContext?.traceSampled,
  };

  const reqWithContext = req as express.Request & {
    jobId?: string;
    requestId?: string;
    sessionId?: string;
  };
  if (jobId) {
    reqWithContext.jobId = jobId;
  }
  reqWithContext.requestId = requestId;
  if (sessionId) {
    reqWithContext.sessionId = sessionId;
  }
  res.setHeader("X-Request-ID", requestId);

  requestContextStorage.run(context, () => {
    updateRequestContextFromRequest(req, res);
    next();
  });
};
