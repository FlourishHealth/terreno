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
