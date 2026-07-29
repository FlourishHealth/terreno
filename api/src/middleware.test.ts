import {beforeEach, describe, expect, it, type Mock, mock} from "bun:test";
import * as Sentry from "@sentry/bun";
import express, {type NextFunction, type Request, type Response} from "express";
import supertest from "supertest";

import {jsonResponseRequestIdMiddleware, sentryAppVersionMiddleware} from "./middleware";
import {requestContextMiddleware} from "./requestContext";

const buildReq = (headers: Record<string, string | undefined>): Request => {
  return {
    get: (name: string) => headers[name],
  } as unknown as Request;
};

const buildNext = (): Mock<() => void> => mock(() => {});

describe("sentryAppVersionMiddleware", () => {
  let setTagMock: Mock<(key: string, value: string) => void>;

  beforeEach(() => {
    // bunSetup.ts mocks @sentry/bun so that getCurrentScope() returns a scope
    // with a Bun mock setTag. Clear that mock between tests so each assertion
    // sees only its own calls.
    setTagMock = Sentry.getCurrentScope().setTag as unknown as Mock<
      (key: string, value: string) => void
    >;
    setTagMock.mockClear();
  });

  it("sets the app_version tag when the App-Version header is present", () => {
    const next = buildNext();
    const req = buildReq({"App-Version": "1.2.3"});

    sentryAppVersionMiddleware(req, {} as Response, next as unknown as NextFunction);

    expect(setTagMock).toHaveBeenCalledTimes(1);
    expect(setTagMock.mock.calls[0]).toEqual(["app_version", "1.2.3"]);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("does not set a tag when the App-Version header is missing", () => {
    const next = buildNext();
    const req = buildReq({});

    sentryAppVersionMiddleware(req, {} as Response, next as unknown as NextFunction);

    expect(setTagMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("does not set a tag when the App-Version header is an empty string", () => {
    const next = buildNext();
    const req = buildReq({"App-Version": ""});

    sentryAppVersionMiddleware(req, {} as Response, next as unknown as NextFunction);

    expect(setTagMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("calls next exactly once with no arguments when the header is present", () => {
    const next = buildNext();

    sentryAppVersionMiddleware(
      buildReq({"App-Version": "9.9.9"}),
      {} as Response,
      next as unknown as NextFunction
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toHaveLength(0);
  });
});

describe("jsonResponseRequestIdMiddleware", () => {
  const buildStackedApp = (): express.Application => {
    const app = express();
    app.use(requestContextMiddleware);
    app.use(jsonResponseRequestIdMiddleware);
    app.get("/object", (_req, res) => {
      return res.json({hello: "world"});
    });
    app.get("/array", (_req, res) => {
      return res.json([1, 2]);
    });
    app.get("/openapi.json", (_req, res) => {
      return res.json({openapi: "3.0.0", paths: {}});
    });
    app.get("/openapi/components/schemas/Food.json", (_req, res) => {
      return res.json({description: "A food", type: "object"});
    });
    app.get("/openapi/validate", (_req, res) => {
      return res.json({document: {openapi: "3.0.0"}, valid: true});
    });
    return app;
  };

  it("adds requestId to object JSON bodies and matches X-Request-ID header", async () => {
    const app = buildStackedApp();
    const res = await supertest(app).get("/object").expect(200);
    expect(res.body.hello).toBe("world");
    expect(res.body.requestId).toBeDefined();
    expect(res.body.requestId).toBe(res.headers["x-request-id"]);
  });

  it("does not wrap JSON array bodies", async () => {
    const app = buildStackedApp();
    const res = await supertest(app).get("/array").expect(200);
    expect(res.body).toEqual([1, 2]);
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("does not inject requestId into GET /openapi.json bodies", async () => {
    const app = buildStackedApp();
    const res = await supertest(app).get("/openapi.json").expect(200);
    expect(res.body).toEqual({openapi: "3.0.0", paths: {}});
    expect(res.body.requestId).toBeUndefined();
  });

  it("does not inject requestId into GET /openapi/components/...json bodies", async () => {
    const app = buildStackedApp();
    const res = await supertest(app).get("/openapi/components/schemas/Food.json").expect(200);
    expect(res.body).toEqual({description: "A food", type: "object"});
    expect(res.body.requestId).toBeUndefined();
  });

  it("does not inject requestId into GET /openapi/validate bodies", async () => {
    const app = buildStackedApp();
    const res = await supertest(app).get("/openapi/validate").expect(200);
    expect(res.body).toEqual({document: {openapi: "3.0.0"}, valid: true});
    expect(res.body.requestId).toBeUndefined();
  });

  it("uses incoming X-Request-ID on wrapped object responses", async () => {
    const app = buildStackedApp();
    const res = await supertest(app)
      .get("/object")
      .set("X-Request-ID", "client-rid-99")
      .expect(200);
    expect(res.body.requestId).toBe("client-rid-99");
    expect(res.headers["x-request-id"]).toBe("client-rid-99");
  });
});
