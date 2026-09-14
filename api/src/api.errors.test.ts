import {describe, expect, it} from "bun:test";
import type {NextFunction, Request, Response} from "express";
import mongoose from "mongoose";

import {
  APIError,
  apiUnauthorizedMiddleware,
  errorsPlugin,
  getAPIErrorBody,
  getDisableExternalErrorTracking,
  isAPIError,
} from "./errors";

describe("errors module", () => {
  describe("APIError", () => {
    it("sets default status to 500 when not provided", () => {
      const error = new APIError({title: "Test error"});
      expect(error.status).toBe(500);
    });

    it("sets status to 500 for invalid status codes below 400", () => {
      const error = new APIError({status: 200, title: "Test error"});
      expect(error.status).toBe(500);
    });

    it("sets status to 500 for invalid status codes above 599", () => {
      const error = new APIError({status: 600, title: "Test error"});
      expect(error.status).toBe(500);
    });

    it("exposes a wrapped error as the cause, keeping the message stable", () => {
      const originalError = new Error("Original error");
      const apiError = new APIError({
        error: originalError,
        title: "Wrapped error",
      });
      expect(apiError.message).toBe("Wrapped error");
      expect(apiError.cause).toBe(originalError);
    });

    it("keeps detail out of the message", () => {
      const error = new APIError({
        detail: "More details here",
        title: "Test error",
      });
      expect(error.message).toBe("Test error");
      expect(error.detail).toBe("More details here");
    });

    it("sets fields in meta when provided", () => {
      const error = new APIError({
        fields: {email: "Invalid email format"},
        title: "Validation error",
      });
      expect(error.meta?.fields).toEqual({email: "Invalid email format"});
    });
  });

  describe("errorsPlugin", () => {
    it("adds apiErrors field to schema", async () => {
      const testSchema = new mongoose.Schema({name: String});
      errorsPlugin(testSchema);

      expect(testSchema.path("apiErrors")).toBeDefined();
    });
  });

  describe("isAPIError", () => {
    it("returns true for APIError instances", () => {
      const error = new APIError({title: "Test"});
      expect(isAPIError(error)).toBe(true);
    });

    it("returns false for regular Error instances", () => {
      const error = new Error("Test");
      expect(isAPIError(error)).toBe(false);
    });
  });

  describe("getDisableExternalErrorTracking", () => {
    it("returns undefined for non-objects", () => {
      expect(getDisableExternalErrorTracking(null)).toBeUndefined();
      expect(getDisableExternalErrorTracking("string")).toBeUndefined();
    });

    it("returns value from APIError", () => {
      const error = new APIError({disableExternalErrorTracking: true, title: "Test"});
      expect(getDisableExternalErrorTracking(error)).toBe(true);
    });

    it("returns value from plain object with property", () => {
      const obj = {disableExternalErrorTracking: true};
      expect(getDisableExternalErrorTracking(obj)).toBe(true);
    });
  });

  describe("getAPIErrorBody", () => {
    it("includes all non-undefined fields", () => {
      const error = new APIError({
        code: "TEST_CODE",
        detail: "Test detail",
        id: "error-123",
        links: {about: "http://example.com"},
        meta: {extra: "data"},
        source: {parameter: "id"},
        status: 400,
        title: "Test error",
      });
      const body = getAPIErrorBody(error);

      expect(body.title).toBe("Test error");
      expect(body.status).toBe(400);
      expect(body.code).toBe("TEST_CODE");
      expect(body.detail).toBe("Test detail");
      expect(body.id).toBe("error-123");
      expect(body.links).toEqual({about: "http://example.com"});
      expect(body.source).toEqual({parameter: "id"});
      expect(body.meta).toEqual({extra: "data"});
    });
  });

  describe("apiUnauthorizedMiddleware", () => {
    interface MockResponse {
      body?: {status: number; title: string};
      statusCode?: number;
      json: (data: {status: number; title: string}) => MockResponse;
      send: () => MockResponse;
      status: (code: number) => MockResponse;
    }

    const createMockResponse = (): MockResponse => {
      const res: MockResponse = {
        json: (data) => {
          res.body = data;
          return res;
        },
        send: () => res,
        status: (code) => {
          res.statusCode = code;
          return res;
        },
      };
      return res;
    };

    it("returns 401 for Unauthorized errors", () => {
      const err = new Error("Unauthorized");
      const res = createMockResponse();
      const next: NextFunction = () => {};

      apiUnauthorizedMiddleware(err, {} as Request, res as unknown as Response, next);
      expect(res.statusCode).toBe(401);
      expect(res.body?.title).toBe("Unauthorized");
    });

    it("calls next for non-Unauthorized errors", () => {
      const err = new Error("Some other error");
      let nextCalled = false;
      const next: NextFunction = () => {
        nextCalled = true;
      };

      apiUnauthorizedMiddleware(err, {} as Request, {} as Response, next);
      expect(nextCalled).toBe(true);
    });

    it("calls next for an APIError whose title is Unauthorized", () => {
      const err = new APIError({code: "not-a-member", status: 403, title: "Unauthorized"});
      let nextArg: unknown;
      const next: NextFunction = (error) => {
        nextArg = error;
      };

      apiUnauthorizedMiddleware(err, {} as Request, {} as Response, next);
      expect(nextArg).toBe(err);
    });
  });
});
