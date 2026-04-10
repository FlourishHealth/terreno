import {describe, expect, it, mock} from "bun:test";
import {APIError} from "@terreno/api";
import type {NextFunction, Request, Response} from "express";

import {requireAdmin} from "./langfuseRoutesMiddleware";

const buildRequest = (user: unknown): Request => {
  return {user} as Request;
};

const buildResponse = (): Response => {
  return {} as Response;
};

describe("requireAdmin", () => {
  it("calls next when user.isAdmin returns true", () => {
    const req = buildRequest({
      admin: false,
      isAdmin: () => true,
    });
    const next = mock(() => {}) as NextFunction;

    requireAdmin(req, buildResponse(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("uses Permissions.IsAdmin fallback when isAdmin is missing", () => {
    const req = buildRequest({admin: true});
    const next = mock(() => {}) as NextFunction;

    requireAdmin(req, buildResponse(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("throws APIError with 403 when user is not admin", () => {
    const req = buildRequest({admin: false});
    const next = mock(() => {}) as NextFunction;

    try {
      requireAdmin(req, buildResponse(), next);
      throw new Error("Expected requireAdmin to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      const apiError = error as APIError;
      expect(apiError.status).toBe(403);
      expect(apiError.title).toBe("Forbidden");
      expect(apiError.disableExternalErrorTracking).toBe(true);
      expect(next).toHaveBeenCalledTimes(0);
    }
  });
});
