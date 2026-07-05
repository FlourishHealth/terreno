import {describe, expect, it} from "bun:test";
import {AxiosError, type AxiosRequestHeaders, type AxiosResponse} from "axios";

import {APIError} from "./errors";
import {type HttpClientLogger, normalizeApiError, withApiErrorHandling} from "./httpClient";

const createRecordingLogger = (): {
  logger: HttpClientLogger;
  entries: {level: string; msg: string; args: unknown[]}[];
} => {
  const entries: {level: string; msg: string; args: unknown[]}[] = [];
  const record =
    (level: string) =>
    (msg: string, ...args: unknown[]): void => {
      entries.push({args, level, msg});
    };
  return {
    entries,
    logger: {debug: record("debug"), error: record("error"), warn: record("warn")},
  };
};

const CONTEXT = {apiName: "testApi", operation: "getWidget"};

const buildAxiosError = ({
  status,
  data,
  code,
}: {
  status?: number;
  data?: unknown;
  code?: string;
}): AxiosError => {
  const config = {headers: {} as AxiosRequestHeaders, url: "/widgets"};
  let response: AxiosResponse | undefined;
  if (status !== undefined) {
    response = {
      config,
      data,
      headers: {},
      status,
      statusText: "",
    } as AxiosResponse;
  }
  return new AxiosError(
    status !== undefined ? `Request failed with status code ${status}` : "Network Error",
    code,
    config,
    undefined,
    response
  );
};

describe("normalizeApiError", () => {
  it("classifies HTTP statuses from an axios error response", () => {
    const cases: [number, string][] = [
      [429, "rateLimited"],
      [401, "unauthorized"],
      [403, "unauthorized"],
      [404, "notFound"],
      [400, "validation"],
      [422, "validation"],
      [500, "server"],
      [503, "server"],
    ];
    for (const [status, classification] of cases) {
      const normalized = normalizeApiError(buildAxiosError({status}), CONTEXT);
      expect(normalized.isAxios).toBe(true);
      expect(normalized.statusCode).toBe(status);
      expect(normalized.classification).toBe(classification as typeof normalized.classification);
    }
  });

  it("extracts messages from a {message} response body", () => {
    const error = buildAxiosError({data: {message: "Widget not found"}, status: 404});
    const normalized = normalizeApiError(error, CONTEXT);
    expect(normalized.messages).toEqual(["Widget not found"]);
  });

  it("extracts messages from a JSONAPI-style {errors: [{title, detail}]} body", () => {
    const error = buildAxiosError({
      data: {
        errors: [
          {detail: "name is required", title: "Validation failed"},
          {title: "Another problem"},
        ],
      },
      status: 422,
    });
    const normalized = normalizeApiError(error, CONTEXT);
    expect(normalized.messages).toEqual(["Validation failed: name is required", "Another problem"]);
  });

  it("extracts a plain-string response body as the message", () => {
    const error = buildAxiosError({data: "Service unavailable", status: 503});
    const normalized = normalizeApiError(error, CONTEXT);
    expect(normalized.messages).toEqual(["Service unavailable"]);
  });

  it("falls back to the axios error message when the body has no recognizable message", () => {
    const error = buildAxiosError({data: {unexpected: true}, status: 500});
    const normalized = normalizeApiError(error, CONTEXT);
    expect(normalized.messages).toEqual(["Request failed with status code 500"]);
  });

  it("classifies an axios error without a response as network", () => {
    const error = buildAxiosError({code: "ECONNREFUSED"});
    const normalized = normalizeApiError(error, CONTEXT);
    expect(normalized.isAxios).toBe(true);
    expect(normalized.statusCode).toBeUndefined();
    expect(normalized.classification).toBe("network");
    expect(normalized.messages).toEqual(["Network Error"]);
  });

  it("classifies a plain Error as unknown and preserves its message", () => {
    const normalized = normalizeApiError(new Error("boom"), CONTEXT);
    expect(normalized.isAxios).toBe(false);
    expect(normalized.statusCode).toBeUndefined();
    expect(normalized.classification).toBe("unknown");
    expect(normalized.messages).toEqual(["boom"]);
  });

  it("classifies a non-Error thrown value as unknown with a stringified message", () => {
    const normalized = normalizeApiError("total failure", CONTEXT);
    expect(normalized.classification).toBe("unknown");
    expect(normalized.messages).toEqual(["total failure"]);
  });

  it("echoes apiName and operation for structured logging", () => {
    const normalized = normalizeApiError(new Error("boom"), CONTEXT);
    expect(normalized.apiName).toBe("testApi");
    expect(normalized.operation).toBe("getWidget");
  });
});

describe("withApiErrorHandling", () => {
  it("returns the wrapped function's result on success and logs nothing", async () => {
    const {logger, entries} = createRecordingLogger();
    const result = await withApiErrorHandling(async () => "ok", {...CONTEXT, logger});
    expect(result).toBe("ok");
    expect(entries).toHaveLength(0);
  });

  it("logs the normalized error and rethrows the original error by default", async () => {
    const {logger, entries} = createRecordingLogger();
    const original = buildAxiosError({data: {message: "nope"}, status: 404});
    let caught: unknown;
    try {
      await withApiErrorHandling(
        async () => {
          throw original;
        },
        {...CONTEXT, logger}
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(original);
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe("error");
    expect(entries[0].msg).toContain("testApi");
    expect(entries[0].msg).toContain("getWidget");
    const normalized = entries[0].args[0] as {statusCode?: number; classification?: string};
    expect(normalized.statusCode).toBe(404);
    expect(normalized.classification).toBe("notFound");
  });

  it("converts to an APIError when rethrowAs is apiError", async () => {
    const {logger} = createRecordingLogger();
    let caught: unknown;
    try {
      await withApiErrorHandling(
        async () => {
          throw buildAxiosError({data: {message: "Rate limit exceeded"}, status: 429});
        },
        {...CONTEXT, logger, rethrowAs: "apiError"}
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(APIError);
    const apiError = caught as APIError;
    expect(apiError.status).toBe(429);
    expect(apiError.title).toBe("testApi getWidget failed: Rate limit exceeded");
  });

  it("defaults the APIError status to 500 when the failure has no status code", async () => {
    const {logger} = createRecordingLogger();
    let caught: unknown;
    try {
      await withApiErrorHandling(
        async () => {
          throw new Error("boom");
        },
        {...CONTEXT, logger, rethrowAs: "apiError"}
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(APIError);
    expect((caught as APIError).status).toBe(500);
  });

  it("applies the redactError hook before logging", async () => {
    const {logger, entries} = createRecordingLogger();
    let caught: unknown;
    try {
      await withApiErrorHandling(
        async () => {
          throw buildAxiosError({data: {message: "patient 12345 not found"}, status: 404});
        },
        {
          ...CONTEXT,
          logger,
          redactError: (normalized) => ({...normalized, messages: ["[redacted]"]}),
        }
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeDefined();
    const logged = entries[0].args[0] as {messages: string[]};
    expect(logged.messages).toEqual(["[redacted]"]);
  });
});
