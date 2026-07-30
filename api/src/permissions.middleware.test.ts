// noExplicitAny: test mock typing
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {describe, expect, it, mock} from "bun:test";
import type express from "express";

import {APIError} from "./errors";
import {Permissions, permissionMiddleware} from "./permissions";

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

  it("calls next immediately for OPTIONS requests", async () => {
    const model = {
      collection: {findOne: mock(async () => null)},
      findById: mock(() => ({exec: mock(async () => null)})),
      modelName: "MockModel",
    } as any;
    const middleware = permissionMiddleware(model, {permissions: allPermissions});
    const next = mock(() => {});

    await middleware(buildReq({method: "OPTIONS"}), {} as express.Response, next as any);

    expect(next).toHaveBeenCalledTimes(1);
    expect((next as any).mock.calls[0]).toEqual([]);
    expect(model.findById).toHaveBeenCalledTimes(0);
  });

  it("returns APIError for unsupported HTTP methods", async () => {
    const model = {
      collection: {findOne: mock(async () => null)},
      findById: mock(() => ({exec: mock(async () => null)})),
      modelName: "MockModel",
    } as any;
    const middleware = permissionMiddleware(model, {permissions: allPermissions});
    const next = mock(() => {});

    await middleware(buildReq({method: "TRACE"}), {} as express.Response, next as any);

    expect(next).toHaveBeenCalledTimes(1);
    const [error] = (next as any).mock.calls[0];
    expect(error).toBeInstanceOf(APIError);
    expect(error.status).toBe(405);
    expect(error.title).toContain("Method TRACE not allowed");
  });

  it("wraps query execution failures in a 500 APIError", async () => {
    const exec = mock(async () => {
      throw new Error("query failed");
    });
    const model = {
      collection: {findOne: mock(async () => null)},
      findById: mock(() => ({exec})),
      modelName: "MockModel",
    } as any;
    const middleware = permissionMiddleware(model, {permissions: allPermissions});
    const next = mock(() => {});

    await middleware(
      buildReq({method: "GET", params: {id: "507f1f77bcf86cd799439011"}}),
      {} as express.Response,
      next as any
    );

    expect(exec).toHaveBeenCalledTimes(1);
    const [error] = (next as any).mock.calls[0];
    expect(error).toBeInstanceOf(APIError);
    expect(error.status).toBe(500);
    expect(error.title).toBe("GET error");
    expect(error.detail).toContain("GET failed on 507f1f77bcf86cd799439011");
  });

  it("returns plain not found when document does not exist", async () => {
    const model = {
      collection: {findOne: mock(async () => null)},
      findById: mock(() => ({exec: mock(async () => null)})),
      modelName: "MockModel",
    } as any;
    const middleware = permissionMiddleware(model, {permissions: allPermissions});
    const next = mock(() => {});

    await middleware(
      buildReq({method: "GET", params: {id: "507f1f77bcf86cd799439011"}}),
      {} as express.Response,
      next as any
    );

    const [error] = (next as any).mock.calls[0];
    expect(error).toBeInstanceOf(APIError);
    expect(error.status).toBe(404);
    expect(error.title).toBe("Document not found");
    expect(error.detail).toContain("507f1f77bcf86cd799439011");
  });

  it("returns hidden reason metadata when document is deleted", async () => {
    const model = {
      collection: {findOne: mock(async () => ({deleted: true}))},
      findById: mock(() => ({exec: mock(async () => null)})),
      modelName: "MockModel",
    } as any;
    const middleware = permissionMiddleware(model, {permissions: allPermissions});
    const next = mock(() => {});

    await middleware(
      buildReq({method: "GET", params: {id: "507f1f77bcf86cd799439011"}}),
      {} as express.Response,
      next as any
    );

    const [error] = (next as any).mock.calls[0];
    expect(error).toBeInstanceOf(APIError);
    expect(error.status).toBe(404);
    expect(error.meta).toEqual({deleted: "true"});
    expect(error.disableExternalErrorTracking).toBe(true);
  });

  it("returns hidden reason metadata when document is disabled", async () => {
    const model = {
      collection: {findOne: mock(async () => ({disabled: true}))},
      findById: mock(() => ({exec: mock(async () => null)})),
      modelName: "MockModel",
    } as any;
    const middleware = permissionMiddleware(model, {permissions: allPermissions});
    const next = mock(() => {});

    await middleware(
      buildReq({method: "GET", params: {id: "507f1f77bcf86cd799439011"}}),
      {} as express.Response,
      next as any
    );

    const [error] = (next as any).mock.calls[0];
    expect(error).toBeInstanceOf(APIError);
    expect(error.status).toBe(404);
    expect(error.meta).toEqual({disabled: "true"});
    expect(error.disableExternalErrorTracking).toBe(true);
  });

  it("returns hidden reason metadata when document is archived", async () => {
    const model = {
      collection: {findOne: mock(async () => ({archived: true}))},
      findById: mock(() => ({exec: mock(async () => null)})),
      modelName: "MockModel",
    } as any;
    const middleware = permissionMiddleware(model, {permissions: allPermissions});
    const next = mock(() => {});

    await middleware(
      buildReq({method: "GET", params: {id: "507f1f77bcf86cd799439011"}}),
      {} as express.Response,
      next as any
    );

    const [error] = (next as any).mock.calls[0];
    expect(error).toBeInstanceOf(APIError);
    expect(error.status).toBe(404);
    expect(error.meta).toEqual({archived: "true"});
    expect(error.disableExternalErrorTracking).toBe(true);
  });

  it("returns plain not found when hidden document has no reason", async () => {
    const model = {
      collection: {findOne: mock(async () => ({foo: "bar"}))},
      findById: mock(() => ({exec: mock(async () => null)})),
      modelName: "MockModel",
    } as any;
    const middleware = permissionMiddleware(model, {permissions: allPermissions});
    const next = mock(() => {});

    await middleware(
      buildReq({method: "GET", params: {id: "507f1f77bcf86cd799439011"}}),
      {} as express.Response,
      next as any
    );

    const [error] = (next as any).mock.calls[0];
    expect(error).toBeInstanceOf(APIError);
    expect(error.status).toBe(404);
    expect(error.title).toBe("Document not found");
  });
});
