import {describe, expect, it, mock} from "bun:test";
import type express from "express";
import type {Model} from "mongoose";

import {APIError} from "./errors";
import {Permissions, permissionMiddleware} from "./permissions";

interface MockDoc {
  archived?: boolean;
  deleted?: boolean;
  disabled?: boolean;
  foo?: string;
}

describe("permissionMiddleware", () => {
  const allPermissions = {
    create: [Permissions.IsAny],
    delete: [Permissions.IsAny],
    list: [Permissions.IsAny],
    read: [Permissions.IsAny],
    update: [Permissions.IsAny],
  };

  const buildReq = (overrides: Record<string, unknown> = {}): express.Request => {
    return {
      method: "GET",
      params: {},
      user: {id: "user-1"},
      ...overrides,
    } as unknown as express.Request;
  };

  const buildModel = ({
    exec = mock(async (): Promise<MockDoc | null> => null),
    hiddenDoc = null,
  }: {
    exec?: () => Promise<MockDoc | null>;
    hiddenDoc?: MockDoc | null;
  } = {}) => {
    const model = {
      collection: {findOne: mock(async () => hiddenDoc)},
      findById: mock(() => ({exec})),
      modelName: "MockModel",
    };
    return {model, modelAsMongoose: model as unknown as Model<MockDoc>};
  };

  const buildNext = () => mock((_error?: unknown) => {});

  const firstError = (next: ReturnType<typeof buildNext>): APIError => {
    const [error] = next.mock.calls[0];
    if (!(error instanceof APIError)) {
      throw new Error(`Expected next to be called with an APIError, got ${String(error)}`);
    }
    return error;
  };

  it("calls next immediately for OPTIONS requests", async () => {
    const {model, modelAsMongoose} = buildModel();
    const middleware = permissionMiddleware(modelAsMongoose, {permissions: allPermissions});
    const next = buildNext();

    await middleware(buildReq({method: "OPTIONS"}), {} as express.Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]).toEqual([]);
    expect(model.findById).toHaveBeenCalledTimes(0);
  });

  it("returns APIError for unsupported HTTP methods", async () => {
    const {modelAsMongoose} = buildModel();
    const middleware = permissionMiddleware(modelAsMongoose, {permissions: allPermissions});
    const next = buildNext();

    await middleware(buildReq({method: "TRACE"}), {} as express.Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = firstError(next);
    expect(error.status).toBe(405);
    expect(error.title).toContain("Method TRACE not allowed");
  });

  it("wraps query execution failures in a 500 APIError", async () => {
    const exec = mock(async (): Promise<MockDoc | null> => {
      throw new Error("query failed");
    });
    const {modelAsMongoose} = buildModel({exec});
    const middleware = permissionMiddleware(modelAsMongoose, {permissions: allPermissions});
    const next = buildNext();

    await middleware(
      buildReq({method: "GET", params: {id: "507f1f77bcf86cd799439011"}}),
      {} as express.Response,
      next
    );

    expect(exec).toHaveBeenCalledTimes(1);
    const error = firstError(next);
    expect(error.status).toBe(500);
    expect(error.title).toBe("GET error");
    expect(error.detail).toContain("GET failed on 507f1f77bcf86cd799439011");
  });

  it("returns plain not found when document does not exist", async () => {
    const {modelAsMongoose} = buildModel();
    const middleware = permissionMiddleware(modelAsMongoose, {permissions: allPermissions});
    const next = buildNext();

    await middleware(
      buildReq({method: "GET", params: {id: "507f1f77bcf86cd799439011"}}),
      {} as express.Response,
      next
    );

    const error = firstError(next);
    expect(error.status).toBe(404);
    expect(error.title).toBe("Document not found");
    expect(error.detail).toContain("507f1f77bcf86cd799439011");
  });

  it("returns hidden reason metadata when document is deleted", async () => {
    const {modelAsMongoose} = buildModel({hiddenDoc: {deleted: true}});
    const middleware = permissionMiddleware(modelAsMongoose, {permissions: allPermissions});
    const next = buildNext();

    await middleware(
      buildReq({method: "GET", params: {id: "507f1f77bcf86cd799439011"}}),
      {} as express.Response,
      next
    );

    const error = firstError(next);
    expect(error.status).toBe(404);
    expect(error.meta).toEqual({deleted: "true"});
    expect(error.disableExternalErrorTracking).toBe(true);
  });

  it("returns hidden reason metadata when document is disabled", async () => {
    const {modelAsMongoose} = buildModel({hiddenDoc: {disabled: true}});
    const middleware = permissionMiddleware(modelAsMongoose, {permissions: allPermissions});
    const next = buildNext();

    await middleware(
      buildReq({method: "GET", params: {id: "507f1f77bcf86cd799439011"}}),
      {} as express.Response,
      next
    );

    const error = firstError(next);
    expect(error.status).toBe(404);
    expect(error.meta).toEqual({disabled: "true"});
    expect(error.disableExternalErrorTracking).toBe(true);
  });

  it("returns hidden reason metadata when document is archived", async () => {
    const {modelAsMongoose} = buildModel({hiddenDoc: {archived: true}});
    const middleware = permissionMiddleware(modelAsMongoose, {permissions: allPermissions});
    const next = buildNext();

    await middleware(
      buildReq({method: "GET", params: {id: "507f1f77bcf86cd799439011"}}),
      {} as express.Response,
      next
    );

    const error = firstError(next);
    expect(error.status).toBe(404);
    expect(error.meta).toEqual({archived: "true"});
    expect(error.disableExternalErrorTracking).toBe(true);
  });

  it("returns plain not found when hidden document has no reason", async () => {
    const {modelAsMongoose} = buildModel({hiddenDoc: {foo: "bar"}});
    const middleware = permissionMiddleware(modelAsMongoose, {permissions: allPermissions});
    const next = buildNext();

    await middleware(
      buildReq({method: "GET", params: {id: "507f1f77bcf86cd799439011"}}),
      {} as express.Response,
      next
    );

    const error = firstError(next);
    expect(error.status).toBe(404);
    expect(error.title).toBe("Document not found");
  });
});
