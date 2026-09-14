import {afterEach, beforeEach, describe, expect, it, type Mock} from "bun:test";
import {Writable} from "node:stream";
import * as Sentry from "@sentry/bun";
import express from "express";
import supertest from "supertest";
import winston from "winston";

import {logger, setupLogging} from "./logger";
import {
  getCurrentLogContext,
  getCurrentRequestContext,
  getCurrentRequestContextAttributes,
  getRequestContextFromAttributes,
  requestContextMiddleware,
  runWithRequestContext,
  runWithRequestContextAttributes,
  setRequestContext,
} from "./requestContext";

describe("request context job propagation", () => {
  beforeEach(() => {
    const scope = Sentry.getCurrentScope();
    (scope.setContext as unknown as Mock<(...args: unknown[]) => void>).mockClear();
    (scope.setTag as unknown as Mock<(...args: unknown[]) => void>).mockClear();
    (scope.setUser as unknown as Mock<(...args: unknown[]) => void>).mockClear();
  });

  afterEach(() => {
    setupLogging({disableFileLogging: true});
  });

  it("serializes the current context for downstream jobs", () => {
    runWithRequestContext(
      {
        jobId: "job-1",
        requestId: "request-1",
        sessionId: "session-1",
        spanId: "span-1",
        traceId: "trace-1",
        traceSampled: false,
        userId: "user-1",
      },
      () => {
        expect(getCurrentRequestContextAttributes()).toEqual({
          "x-job-id": "job-1",
          "x-request-id": "request-1",
          "x-session-id": "session-1",
          "x-span-id": "span-1",
          "x-trace-id": "trace-1",
          "x-trace-sampled": "false",
          "x-user-id": "user-1",
        });
      }
    );
  });

  it("allows downstream jobs to replace only the job id", () => {
    runWithRequestContext(
      {jobId: "job-parent", requestId: "request-1", sessionId: "session-1"},
      () => {
        expect(getCurrentRequestContextAttributes({jobId: "job-child"})).toEqual({
          "x-job-id": "job-child",
          "x-request-id": "request-1",
          "x-session-id": "session-1",
        });
      }
    );
  });

  it("restores worker context from message attributes", () => {
    const scope = Sentry.getCurrentScope();
    const setContextMock = scope.setContext as unknown as Mock<(...args: unknown[]) => void>;
    const setTagMock = scope.setTag as unknown as Mock<(...args: unknown[]) => void>;
    const setUserMock = scope.setUser as unknown as Mock<(...args: unknown[]) => void>;

    runWithRequestContextAttributes(
      {
        traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        "x-job-id": "job-worker-1",
        "x-request-id": "request-1",
        "x-session-id": "session-1",
        "x-user-id": "user-1",
      },
      () => {
        expect(getCurrentRequestContext()).toEqual({
          jobId: "job-worker-1",
          requestId: "request-1",
          sessionId: "session-1",
          spanId: "00f067aa0ba902b7",
          traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
          traceSampled: true,
          userId: "user-1",
        });
      }
    );

    expect(setTagMock).toHaveBeenCalledWith("request_id", "request-1");
    expect(setTagMock).toHaveBeenCalledWith("session_id", "session-1");
    expect(setTagMock).toHaveBeenCalledWith("job_id", "job-worker-1");
    expect(setTagMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(setTagMock).toHaveBeenCalledWith("trace_id", "4bf92f3577b34da6a3ce929d0e0e4736");
    expect(setUserMock).toHaveBeenCalledWith({id: "user-1"});
    expect(setContextMock).toHaveBeenCalledWith("request_context", {
      jobId: "job-worker-1",
      requestId: "request-1",
      sessionId: "session-1",
      spanId: "00f067aa0ba902b7",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      traceSampled: true,
      userId: "user-1",
    });
  });

  it("sends context updates to Sentry for auth session changes", () => {
    const scope = Sentry.getCurrentScope();
    const setTagMock = scope.setTag as unknown as Mock<(...args: unknown[]) => void>;
    const setUserMock = scope.setUser as unknown as Mock<(...args: unknown[]) => void>;

    runWithRequestContext({requestId: "request-auth-1"}, () => {
      setTagMock.mockClear();
      setUserMock.mockClear();
      setRequestContext({sessionId: "session-auth-1", userId: "user-auth-1"});
    });

    expect(setTagMock).toHaveBeenCalledWith("session_id", "session-auth-1");
    expect(setTagMock).toHaveBeenCalledWith("user_id", "user-auth-1");
    expect(setUserMock).toHaveBeenCalledWith({id: "user-auth-1"});
  });

  it("uses trace id as request id when attributes do not include request id", () => {
    const context = getRequestContextFromAttributes({
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00",
      "x-job-id": "job-worker-1",
    });

    expect(context).toEqual({
      jobId: "job-worker-1",
      requestId: "4bf92f3577b34da6a3ce929d0e0e4736",
      sessionId: undefined,
      spanId: "00f067aa0ba902b7",
      traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
      traceSampled: false,
      userId: undefined,
    });
  });

  it("accepts job id from HTTP headers", async () => {
    const app = express();
    app.use(requestContextMiddleware);
    app.get("/job", (req, res) => {
      res.json({context: getCurrentLogContext(), jobId: req.jobId});
    });

    const res = await supertest(app)
      .get("/job")
      .set("X-Job-ID", "job-http-1")
      .set("X-Request-ID", "request-http-1")
      .expect(200);

    expect(res.headers["x-job-id"]).toBe("job-http-1");
    expect(res.body).toEqual({
      context: {jobId: "job-http-1", requestId: "request-http-1"},
      jobId: "job-http-1",
    });
  });

  it("parses Google Cloud trace context header in middleware", async () => {
    const app = express();
    app.use(requestContextMiddleware);
    app.get("/trace-gcloud", (_req, res) => {
      const ctx = getCurrentRequestContext();
      res.json({
        spanId: ctx?.spanId,
        traceId: ctx?.traceId,
        traceSampled: ctx?.traceSampled,
      });
    });

    const res = await supertest(app)
      .get("/trace-gcloud")
      .set("X-Cloud-Trace-Context", "105445aa7843bc8bf206b12000100000/1;o=1")
      .expect(200);

    expect(res.body.traceId).toBe("105445aa7843bc8bf206b12000100000");
    expect(res.body.spanId).toBe("1");
    expect(res.body.traceSampled).toBe(true);
  });

  it("parses Google Cloud trace context without trace sampling", async () => {
    const app = express();
    app.use(requestContextMiddleware);
    app.get("/trace-gcloud-nosample", (_req, res) => {
      const ctx = getCurrentRequestContext();
      res.json({
        spanId: ctx?.spanId,
        traceId: ctx?.traceId,
        traceSampled: ctx?.traceSampled,
      });
    });

    const res = await supertest(app)
      .get("/trace-gcloud-nosample")
      .set("X-Cloud-Trace-Context", "abc123/42;o=0")
      .expect(200);

    expect(res.body.traceId).toBe("abc123");
    expect(res.body.spanId).toBe("42");
    expect(res.body.traceSampled).toBe(false);
  });

  it("falls back to traceparent when cloud trace context is absent", async () => {
    const app = express();
    app.use(requestContextMiddleware);
    app.get("/trace-parent", (_req, res) => {
      const ctx = getCurrentRequestContext();
      res.json({
        spanId: ctx?.spanId,
        traceId: ctx?.traceId,
        traceSampled: ctx?.traceSampled,
      });
    });

    const res = await supertest(app)
      .get("/trace-parent")
      .set("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
      .expect(200);

    expect(res.body.traceId).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
    expect(res.body.spanId).toBe("00f067aa0ba902b7");
    expect(res.body.traceSampled).toBe(true);
  });

  it("uses trace id as request id when no explicit request id header is set", async () => {
    const app = express();
    app.use(requestContextMiddleware);
    app.get("/trace-request-id", (_req, res) => {
      const ctx = getCurrentRequestContext();
      res.json({requestId: ctx?.requestId});
    });

    const res = await supertest(app)
      .get("/trace-request-id")
      .set("X-Cloud-Trace-Context", "trace-as-rid/99;o=1")
      .expect(200);

    expect(res.body.requestId).toBe("trace-as-rid");
  });

  it("handles traceSampled attribute values 'true', '1', 'false', '0'", () => {
    const ctxTrue = getRequestContextFromAttributes({
      "x-request-id": "r1",
      "x-trace-sampled": "true",
    });
    expect(ctxTrue.traceSampled).toBe(true);

    const ctx1 = getRequestContextFromAttributes({
      "x-request-id": "r2",
      "x-trace-sampled": "1",
    });
    expect(ctx1.traceSampled).toBe(true);

    const ctxFalse = getRequestContextFromAttributes({
      "x-request-id": "r3",
      "x-trace-sampled": "false",
    });
    expect(ctxFalse.traceSampled).toBe(false);

    const ctx0 = getRequestContextFromAttributes({
      "x-request-id": "r4",
      "x-trace-sampled": "0",
    });
    expect(ctx0.traceSampled).toBe(false);
  });

  it("parses Google Cloud trace context with missing span id", () => {
    const ctx = getRequestContextFromAttributes({
      "x-cloud-trace-context": "only-trace-id",
      "x-request-id": "r5",
    });
    expect(ctx.traceId).toBe("only-trace-id");
    expect(ctx.spanId).toBeUndefined();
  });

  it("returns undefined trace when traceparent has empty trace id", () => {
    const ctx = getRequestContextFromAttributes({
      traceparent: "00--span-01",
      "x-request-id": "r6",
    });
    expect(ctx.traceId).toBeUndefined();
  });

  it("returns undefined trace when google cloud trace context has empty trace id", () => {
    const ctx = getRequestContextFromAttributes({
      "x-cloud-trace-context": "/1;o=1",
      "x-request-id": "r7",
    });
    expect(ctx.traceId).toBeUndefined();
    expect(ctx.spanId).toBeUndefined();
    expect(ctx.requestId).toBe("r7");
  });

  it("reads the first value when a request header arrives as an array", () => {
    const headers: Record<string, string[] | string | undefined> = {
      "x-cloud-trace-context": ["arrtrace/7;o=1", "ignored/9;o=0"],
    };
    const req = {
      header: (name: string): string[] | string | undefined => headers[name.toLowerCase()],
      user: undefined,
    } as unknown as express.Request;
    const res = {
      setHeader: (): void => {},
    } as unknown as express.Response;

    let captured: {spanId?: string; traceId?: string} | undefined;
    requestContextMiddleware(req, res, () => {
      const ctx = getCurrentRequestContext();
      captured = {spanId: ctx?.spanId, traceId: ctx?.traceId};
    });

    expect(captured?.traceId).toBe("arrtrace");
    expect(captured?.spanId).toBe("7");
  });

  it("adds job id to logger context", () => {
    let output = "";
    const stream = new Writable({
      write: (chunk, _encoding, callback): void => {
        output += chunk.toString();
        callback();
      },
    });

    setupLogging({
      disableConsoleLogging: true,
      disableFileLogging: true,
      transports: [
        new winston.transports.Stream({
          format: winston.format.printf((info) => {
            return `${info.level}: ${info.message} requestId=${info.requestId} jobId=${info.jobId}`;
          }),
          stream,
        }),
      ],
    });

    runWithRequestContext({jobId: "job-log-1", requestId: "request-log-1"}, () => {
      logger.info("worker handled job");
    });

    expect(output).toContain("requestId=request-log-1");
    expect(output).toContain("jobId=job-log-1");
  });
});
