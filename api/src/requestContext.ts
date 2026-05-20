import {AsyncLocalStorage} from "node:async_hooks";
import {randomUUID} from "node:crypto";
import type express from "express";
import type {JwtPayload} from "jsonwebtoken";

const CLOUD_TRACE_CONTEXT_HEADER = "x-cloud-trace-context";
const REQUEST_ID_HEADERS = ["x-request-id", "x-correlation-id", "x-transaction-id"];
const SESSION_ID_HEADER = "x-session-id";
const TRACE_PARENT_HEADER = "traceparent";

export interface RequestContext {
  requestId: string;
  sessionId?: string;
  spanId?: string;
  traceId?: string;
  traceSampled?: boolean;
  userId?: string;
}

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

export const getCurrentRequestContext = (): RequestContext | undefined => {
  return requestContextStorage.getStore();
};

export const getCurrentLogContext = (): Partial<RequestContext> => {
  const context = getCurrentRequestContext();
  if (!context) {
    return {};
  }

  return {
    requestId: context.requestId,
    sessionId: context.sessionId,
    spanId: context.spanId,
    traceId: context.traceId,
    traceSampled: context.traceSampled,
    userId: context.userId,
  };
};

export const setRequestContext = (updates: Partial<RequestContext>): void => {
  const context = getCurrentRequestContext();
  if (!context) {
    return;
  }
  Object.assign(context, updates);
};

export const updateRequestContextFromRequest = (
  req: express.Request,
  res?: express.Response
): void => {
  const reqWithContext = req as express.Request & {
    authTokenPayload?: JwtSessionPayload;
    betterAuthSession?: {session?: {id?: string}};
    sessionId?: string;
  };
  const sessionId =
    getSessionIdFromJwtPayload(reqWithContext.authTokenPayload) ??
    reqWithContext.betterAuthSession?.session?.id ??
    reqWithContext.sessionId ??
    getHeader(req, SESSION_ID_HEADER);
  const userId = req.user?.id ?? (req.user?._id ? String(req.user._id) : undefined);

  setRequestContext({sessionId, userId});

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
  const sessionId = getHeader(req, SESSION_ID_HEADER);

  const context: RequestContext = {
    requestId,
    sessionId,
    spanId: traceContext?.spanId,
    traceId: traceContext?.traceId,
    traceSampled: traceContext?.traceSampled,
  };

  req.requestId = requestId;
  if (sessionId) {
    req.sessionId = sessionId;
  }
  res.setHeader("X-Request-ID", requestId);

  requestContextStorage.run(context, () => {
    updateRequestContextFromRequest(req, res);
    next();
  });
};
