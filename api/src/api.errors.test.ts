import {describe, expect, it} from "bun:test";
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

    it("includes error stack in message when error is provided", () => {
      const originalError = new Error("Original error");
      const apiError = new APIError({
        error: originalError,
        title: "Wrapped error",
      });
      expect(apiError.message).toContain("Wrapped error");
      expect(originalError.stack).toBeDefined();
      expect(apiError.message).toContain(originalError.stack as string);
    });

    it("includes detail in message when provided", () => {
      const error = new APIError({
        detail: "More details here",
        title: "Test error",
      });
      expect(error.message).toContain("Test error");
      expect(error.message).toContain("More details here");
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
    it("returns 401 for Unauthorized errors", () => {
      const err = new Error("Unauthorized");
      const res = {
        json: function (data: any) {
          (this as any).body = data;
          return this;
        },
        send: function () {
          return this;
        },
        status: function (code: number) {
          (this as any).statusCode = code;
          return this;
        },
      };
      const next = () => {};

      apiUnauthorizedMiddleware(err, {} as any, res as any, next);
      expect((res as any).statusCode).toBe(401);
      expect((res as any).body.title).toBe("Unauthorized");
    });

    it("calls next for non-Unauthorized errors", () => {
      const err = new Error("Some other error");
      let nextCalled = false;
      const next = () => {
        nextCalled = true;
      };

      apiUnauthorizedMiddleware(err, {} as any, {} as any, next);
      expect(nextCalled).toBe(true);
    });
  });
});
