import crypto from "node:crypto";
import {describe, expect, it, mock} from "bun:test";
import type {NextFunction, Request, Response} from "express";

import {openApiEtagMiddleware} from "./openApiEtag";

interface BuildRequestOptions {
  ifNoneMatch?: string;
  method?: string;
  path?: string;
}

const buildRequest = (options: BuildRequestOptions = {}): Request => {
  const {ifNoneMatch, method = "GET", path = "/openapi.json"} = options;
  return {
    get: (header: string) => {
      return header === "If-None-Match" ? ifNoneMatch : undefined;
    },
    method,
    path,
  } as Request;
};

const buildResponse = (): {
  originalJson: ReturnType<typeof mock>;
  res: Response;
  set: ReturnType<typeof mock>;
  status: ReturnType<typeof mock>;
  end: ReturnType<typeof mock>;
} => {
  const originalJson = mock((body: unknown) => ({body}));
  const resObject = {
    json: originalJson,
  } as unknown as Response & Record<string, unknown>;
  const set = mock(() => resObject);
  const status = mock(() => resObject);
  const end = mock(() => resObject);

  resObject.set = set;
  resObject.status = status;
  resObject.end = end;

  return {
    end,
    originalJson,
    res: resObject,
    set,
    status,
  };
};

describe("openApiEtagMiddleware", () => {
  it("skips non-openapi requests", () => {
    const req = buildRequest({method: "POST", path: "/health"});
    const {res, originalJson} = buildResponse();
    const next = mock(() => {}) as NextFunction;

    openApiEtagMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).toBe(originalJson);
  });

  it("sets ETag and returns json body when no matching If-None-Match header is provided", () => {
    const req = buildRequest();
    const {res, originalJson, set, status, end} = buildResponse();
    const next = mock(() => {}) as NextFunction;
    const body = {openapi: "3.0.0", paths: {"/todos": {get: {}}}};

    openApiEtagMiddleware(req, res, next);

    const result = res.json(body);
    const expectedEtag = `"${crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex").substring(0, 16)}"`;

    expect(next).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith("ETag", expectedEtag);
    expect(originalJson).toHaveBeenCalledWith(body);
    expect(status).toHaveBeenCalledTimes(0);
    expect(end).toHaveBeenCalledTimes(0);
    expect(result).toEqual({body});
  });

  it("returns 304 when If-None-Match matches generated ETag", () => {
    const body = {openapi: "3.0.0", paths: {"/users": {post: {}}}};
    const etag = `"${crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex").substring(0, 16)}"`;
    const req = buildRequest({ifNoneMatch: etag});
    const {res, originalJson, set, status, end} = buildResponse();
    const next = mock(() => {}) as NextFunction;

    openApiEtagMiddleware(req, res, next);

    const result = res.json(body);

    expect(next).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith("ETag", etag);
    expect(status).toHaveBeenCalledWith(304);
    expect(end).toHaveBeenCalledTimes(1);
    expect(originalJson).toHaveBeenCalledTimes(0);
    expect(result).toBe(res);
  });
});
