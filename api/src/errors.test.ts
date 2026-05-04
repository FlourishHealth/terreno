import {beforeEach, describe, expect, it, mock} from "bun:test";
import * as Sentry from "@sentry/node";
import type {NextFunction, Request, Response} from "express";
import {Schema} from "mongoose";

import {
  APIError,
  apiErrorMiddleware,
  apiUnauthorizedMiddleware,
  errorsPlugin,
  getAPIErrorBody,
  getDisableExternalErrorTracking,
  isAPIError,
} from "./errors";

interface MockResponse {
  status: ReturnType<typeof mock>;
  json: ReturnType<typeof mock>;
  send: ReturnType<typeof mock>;
}

const buildResponse = (): MockResponse => {
  const res: MockResponse = {
    json: mock(() => res),
    send: mock(() => res),
    status: mock(() => res),
  };
  return res;
};

describe("APIError", () => {
  it("creates an error with the provided fields", () => {
    const error = new APIError({
      code: "validation-failed",
      detail: "Email is invalid",
      id: "abc-123",
      links: {about: "https://example.com/help", type: "https://example.com/types/validation"},
      meta: {requestId: "req-1"},
      source: {header: "x-foo", parameter: "limit", pointer: "/data/email"},
      status: 400,
      title: "Validation failed",
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("APIError");
    expect(error.title).toBe("Validation failed");
    expect(error.detail).toBe("Email is invalid");
    expect(error.code).toBe("validation-failed");
    expect(error.status).toBe(400);
    expect(error.id).toBe("abc-123");
    expect(error.links).toEqual({
      about: "https://example.com/help",
      type: "https://example.com/types/validation",
    });
    expect(error.source).toEqual({
      header: "x-foo",
      parameter: "limit",
      pointer: "/data/email",
    });
    expect(error.meta).toEqual({requestId: "req-1"});
  });

  it("includes the title and detail in the error message", () => {
    const error = new APIError({detail: "Something exploded", title: "Boom"});
    expect(error.message).toBe("Boom: Something exploded");
  });

  it("includes the wrapped error stack in the message", () => {
    const wrapped = new Error("inner");
    const error = new APIError({error: wrapped, title: "Outer"});
    expect(error.message).toContain("Outer");
    expect(error.message).toContain(wrapped.stack ?? "");
  });

  it("defaults status to 500 when status is omitted", () => {
    const error = new APIError({title: "No status"});
    expect(error.status).toBe(500);
  });

  it("forces status to 500 when below 400", () => {
    const error = new APIError({status: 200, title: "Too low"});
    expect(error.status).toBe(500);
  });

  it("forces status to 500 when above 599", () => {
    const error = new APIError({status: 600, title: "Too high"});
    expect(error.status).toBe(500);
  });

  it("defaults meta to an empty object when not provided", () => {
    const error = new APIError({title: "No meta"});
    expect(error.meta).toEqual({});
  });

  it("merges fields into meta", () => {
    const error = new APIError({
      fields: {email: "Required", name: "Required"},
      title: "Validation",
    });
    expect(error.meta?.fields).toEqual({email: "Required", name: "Required"});
  });

  it("respects disableExternalErrorTracking", () => {
    const trackedError = new APIError({title: "Tracked"});
    const untrackedError = new APIError({
      disableExternalErrorTracking: true,
      title: "Untracked",
    });
    expect(trackedError.disableExternalErrorTracking).toBeUndefined();
    expect(untrackedError.disableExternalErrorTracking).toBe(true);
  });
});

describe("isAPIError", () => {
  it("returns true for an APIError instance", () => {
    expect(isAPIError(new APIError({title: "Boom"}))).toBe(true);
  });

  it("returns false for a regular Error", () => {
    expect(isAPIError(new Error("nope"))).toBe(false);
  });

  it("returns true for any error whose name is APIError", () => {
    const err = new Error("custom");
    err.name = "APIError";
    expect(isAPIError(err)).toBe(true);
  });
});

describe("getDisableExternalErrorTracking", () => {
  it("returns the flag from an APIError", () => {
    const error = new APIError({disableExternalErrorTracking: true, title: "Test"});
    expect(getDisableExternalErrorTracking(error)).toBe(true);
  });

  it("returns undefined for a plain Error without the flag", () => {
    expect(getDisableExternalErrorTracking(new Error("plain"))).toBeUndefined();
  });

  it("returns the flag when attached to a non-APIError object", () => {
    const error = {disableExternalErrorTracking: false};
    expect(getDisableExternalErrorTracking(error)).toBe(false);
  });

  it("returns undefined for primitives and null", () => {
    expect(getDisableExternalErrorTracking(null)).toBeUndefined();
    expect(getDisableExternalErrorTracking(undefined)).toBeUndefined();
    expect(getDisableExternalErrorTracking("string")).toBeUndefined();
    expect(getDisableExternalErrorTracking(42)).toBeUndefined();
  });

  it("returns undefined for an object missing the property", () => {
    expect(getDisableExternalErrorTracking({foo: "bar"})).toBeUndefined();
  });
});

describe("getAPIErrorBody", () => {
  it("returns title and status by default", () => {
    const error = new APIError({status: 404, title: "Not Found"});
    const body = getAPIErrorBody(error);
    expect(body).toEqual({meta: {}, status: 404, title: "Not Found"});
  });

  it("includes optional fields when set", () => {
    const error = new APIError({
      code: "not-found",
      detail: "Could not find resource",
      disableExternalErrorTracking: true,
      id: "err-1",
      links: {about: "https://example.com/help"},
      source: {pointer: "/data/id"},
      status: 404,
      title: "Not Found",
    });
    const body = getAPIErrorBody(error);
    expect(body).toEqual({
      code: "not-found",
      detail: "Could not find resource",
      disableExternalErrorTracking: true,
      id: "err-1",
      links: {about: "https://example.com/help"},
      meta: {},
      source: {pointer: "/data/id"},
      status: 404,
      title: "Not Found",
    });
  });

  it("omits empty meta and unset optional fields", () => {
    const error = new APIError({status: 400, title: "Bad"});
    // meta defaults to {} which is truthy, so it is included.
    const body = getAPIErrorBody(error);
    expect(body.meta).toEqual({});
    expect(body.code).toBeUndefined();
    expect(body.detail).toBeUndefined();
    expect(body.id).toBeUndefined();
    expect(body.links).toBeUndefined();
    expect(body.source).toBeUndefined();
  });
});

describe("errorsPlugin", () => {
  it("adds an apiErrors array field to the schema", () => {
    const schema = new Schema({name: String});
    errorsPlugin(schema);
    const path = schema.path("apiErrors");
    expect(path).toBeDefined();
  });

  it("requires title on each error subdocument", () => {
    const schema = new Schema({name: String});
    errorsPlugin(schema);
    const path = schema.path("apiErrors");
    // Inspect the embedded error schema for the title definition.
    const embedded = path as unknown as {schema: Schema};
    const titlePath = embedded.schema.path("title");
    expect(titlePath).toBeDefined();
    expect(titlePath.isRequired).toBe(true);
  });
});

describe("apiUnauthorizedMiddleware", () => {
  let res: MockResponse;
  let next: ReturnType<typeof mock>;
  const req = {} as Request;

  beforeEach(() => {
    res = buildResponse();
    next = mock(() => {});
  });

  it("returns a 401 JSON response when the message is Unauthorized", () => {
    apiUnauthorizedMiddleware(
      new Error("Unauthorized"),
      req,
      res as unknown as Response,
      next as unknown as NextFunction
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({status: 401, title: "Unauthorized"});
    expect(res.send).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards other errors to next", () => {
    const err = new Error("Something else");
    apiUnauthorizedMiddleware(
      err,
      req,
      res as unknown as Response,
      next as unknown as NextFunction
    );
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("apiErrorMiddleware", () => {
  let res: MockResponse;
  let next: ReturnType<typeof mock>;
  const req = {} as Request;
  const captureExceptionSpy = Sentry.captureException as unknown as ReturnType<typeof mock>;

  beforeEach(() => {
    res = buildResponse();
    next = mock(() => {});
    captureExceptionSpy.mockClear?.();
  });

  it("responds with the APIError status and body", () => {
    const err = new APIError({detail: "missing", status: 404, title: "Not Found"});
    apiErrorMiddleware(err, req, res as unknown as Response, next as unknown as NextFunction);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(getAPIErrorBody(err));
    expect(res.send).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("captures the exception with Sentry by default", () => {
    const err = new APIError({status: 500, title: "Boom"});
    apiErrorMiddleware(err, req, res as unknown as Response, next as unknown as NextFunction);
    expect(captureExceptionSpy).toHaveBeenCalledWith(err);
  });

  it("does not capture the exception when disableExternalErrorTracking is true", () => {
    const err = new APIError({
      disableExternalErrorTracking: true,
      status: 500,
      title: "Quiet",
    });
    apiErrorMiddleware(err, req, res as unknown as Response, next as unknown as NextFunction);
    expect(captureExceptionSpy).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("forwards non-APIError errors to next", () => {
    const err = new Error("not an api error");
    apiErrorMiddleware(err, req, res as unknown as Response, next as unknown as NextFunction);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});
