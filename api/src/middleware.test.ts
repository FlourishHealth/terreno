import {beforeEach, describe, expect, it, type Mock, mock} from "bun:test";
import * as Sentry from "@sentry/bun";
import type {NextFunction, Request, Response} from "express";

import {sentryAppVersionMiddleware} from "./middleware";

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
