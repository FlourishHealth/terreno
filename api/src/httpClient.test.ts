import type {Server} from "node:http";
import type {AddressInfo} from "node:net";

import {describe, expect, it} from "bun:test";
import {AxiosError, type AxiosRequestHeaders, type AxiosResponse, isAxiosError} from "axios";
import express from "express";

import {APIError} from "./errors";
import {
  createAuthenticatedClient,
  type HttpClientLogger,
  normalizeApiError,
  withApiErrorHandling,
} from "./httpClient";

const startTestServer = async (
  configure: (app: express.Express) => void
): Promise<{baseURL: string; close: () => Promise<void>}> => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({extended: false}));
  configure(app);
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(0, () => resolve(listening));
  });
  const {port} = server.address() as AddressInfo;
  return {
    baseURL: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
};

// Tests use a 1ms base delay so retry backoff doesn't slow the suite.
const FAST_RETRY = {baseDelayMs: 1};

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

  it("classifies a sub-400 response status as unknown", () => {
    const normalized = normalizeApiError(buildAxiosError({status: 302}), CONTEXT);
    expect(normalized.classification).toBe("unknown");
    expect(normalized.statusCode).toBe(302);
  });

  it("extracts detail-only JSONAPI error entries", () => {
    const error = buildAxiosError({data: {errors: [{detail: "just a detail"}]}, status: 400});
    const normalized = normalizeApiError(error, CONTEXT);
    expect(normalized.messages).toEqual(["just a detail"]);
  });

  it("falls back to the axios message for empty-string, empty-message, and empty-errors bodies", () => {
    for (const data of ["", {message: ""}, {errors: []}]) {
      const normalized = normalizeApiError(buildAxiosError({data, status: 500}), CONTEXT);
      expect(normalized.messages).toEqual(["Request failed with status code 500"]);
    }
  });

  it("falls back to the axios message when the errors array has no usable entries", () => {
    const error = buildAxiosError({data: {errors: ["oops", null, 42, {title: 5}]}, status: 500});
    const normalized = normalizeApiError(error, CONTEXT);
    expect(normalized.messages).toEqual(["Request failed with status code 500"]);
  });

  it("truncates long plain-string bodies so unbounded payloads never reach the logger", () => {
    const error = buildAxiosError({data: "x".repeat(2000), status: 503});
    const normalized = normalizeApiError(error, CONTEXT);
    expect(normalized.messages[0].length).toBeLessThanOrEqual(512);
    expect(normalized.messages[0].endsWith("…")).toBe(true);
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

  it("converts to an APIError when rethrowAs is apiError, logging via APIError only", async () => {
    const {logger, entries} = createRecordingLogger();
    const original = buildAxiosError({data: {message: "Rate limit exceeded"}, status: 429});
    let caught: unknown;
    try {
      await withApiErrorHandling(
        async () => {
          throw original;
        },
        {...CONTEXT, logger, rethrowAs: "apiError"}
      );
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(APIError);
    const apiError = caught as APIError;
    expect(apiError.status).toBe(429);
    expect(apiError.title).toBe("testApi getWidget request failed");
    expect(apiError.detail).toBe("Rate limit exceeded");
    expect(apiError.error).toBe(original);
    expect(apiError.meta?.classification).toBe("rateLimited");
    // Logged exactly once: the APIError constructor logs, so the wrapper must not.
    expect(entries).toHaveLength(0);
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

  it("clamps sub-400 response statuses to a 500 APIError", async () => {
    const {logger} = createRecordingLogger();
    let caught: unknown;
    try {
      await withApiErrorHandling(
        async () => {
          throw buildAxiosError({status: 302});
        },
        {...CONTEXT, logger, rethrowAs: "apiError"}
      );
    } catch (error) {
      caught = error;
    }
    expect((caught as APIError).status).toBe(500);
  });

  it("applies the redactError hook before logging", async () => {
    const {logger, entries} = createRecordingLogger();
    const original = buildAxiosError({data: {message: "patient 12345 not found"}, status: 404});
    let caught: unknown;
    try {
      await withApiErrorHandling(
        async () => {
          throw original;
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
    expect(caught).toBe(original);
    const logged = entries[0].args[0] as {messages: string[]};
    expect(logged.messages).toEqual(["[redacted]"]);
  });

  it("uses redacted messages in the APIError detail when combined with rethrowAs apiError", async () => {
    const {logger} = createRecordingLogger();
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
          rethrowAs: "apiError",
        }
      );
    } catch (error) {
      caught = error;
    }
    const apiError = caught as APIError;
    expect(apiError.detail).toBe("[redacted]");
    expect(apiError.message).not.toContain("patient 12345");
  });

  it("falls back to a generic detail when redactError strips all messages", async () => {
    const {logger} = createRecordingLogger();
    let caught: unknown;
    try {
      await withApiErrorHandling(
        async () => {
          throw buildAxiosError({data: {message: "sensitive"}, status: 404});
        },
        {
          ...CONTEXT,
          logger,
          redactError: (normalized) => ({...normalized, messages: []}),
          rethrowAs: "apiError",
        }
      );
    } catch (error) {
      caught = error;
    }
    expect((caught as APIError).detail).toBe("unknown error");
  });
});

describe("createAuthenticatedClient", () => {
  describe("bearer strategy", () => {
    it("attaches the Authorization header and caches the token across requests", async () => {
      const seenAuthHeaders: (string | undefined)[] = [];
      const server = await startTestServer((app) => {
        app.get("/widgets", (req, res) => {
          seenAuthHeaders.push(req.headers.authorization);
          res.json({ok: true});
        });
      });
      try {
        let tokenFetches = 0;
        const client = createAuthenticatedClient({
          auth: {
            getToken: async () => {
              tokenFetches += 1;
              return "token-abc";
            },
            type: "bearer",
          },
          baseURL: server.baseURL,
        });
        await client.axios.get("/widgets");
        await client.axios.get("/widgets");
        expect(seenAuthHeaders).toEqual(["Bearer token-abc", "Bearer token-abc"]);
        expect(tokenFetches).toBe(1);
      } finally {
        await server.close();
      }
    });

    it("re-fetches the token after invalidateToken", async () => {
      const server = await startTestServer((app) => {
        app.get("/widgets", (_req, res) => {
          res.json({ok: true});
        });
      });
      try {
        let tokenFetches = 0;
        const client = createAuthenticatedClient({
          auth: {
            getToken: async () => {
              tokenFetches += 1;
              return `token-${tokenFetches}`;
            },
            type: "bearer",
          },
          baseURL: server.baseURL,
        });
        await client.axios.get("/widgets");
        client.invalidateToken();
        await client.axios.get("/widgets");
        expect(tokenFetches).toBe(2);
      } finally {
        await server.close();
      }
    });
  });

  describe("apiKey strategy", () => {
    it("attaches the key to the configured header", async () => {
      const seenKeys: (string | undefined)[] = [];
      const server = await startTestServer((app) => {
        app.get("/widgets", (req, res) => {
          seenKeys.push(req.headers["x-api-key"] as string | undefined);
          res.json({ok: true});
        });
      });
      try {
        const client = createAuthenticatedClient({
          auth: {getKey: async () => "secret-key", header: "X-Api-Key", type: "apiKey"},
          baseURL: server.baseURL,
        });
        await client.axios.get("/widgets");
        expect(seenKeys).toEqual(["secret-key"]);
      } finally {
        await server.close();
      }
    });
  });

  describe("oauth2 strategy", () => {
    const configureOauthServer = (
      app: express.Express,
      state: {tokenFetches: number; validToken: string}
    ): void => {
      app.post("/oauth/token", (req, res) => {
        state.tokenFetches += 1;
        const authHeader = req.headers.authorization ?? "";
        const decoded = Buffer.from(authHeader.replace("Basic ", ""), "base64").toString();
        if (decoded !== "client-id:client-secret" || req.body.grant_type !== "client_credentials") {
          res.status(400).json({message: "bad token request"});
          return;
        }
        res.json({access_token: state.validToken});
      });
    };

    it("fetches a client-credentials token and sends it as a bearer", async () => {
      const state = {tokenFetches: 0, validToken: "oauth-token-1"};
      const seenAuthHeaders: (string | undefined)[] = [];
      const server = await startTestServer((app) => {
        configureOauthServer(app, state);
        app.get("/widgets", (req, res) => {
          seenAuthHeaders.push(req.headers.authorization);
          res.json({ok: true});
        });
      });
      try {
        const client = createAuthenticatedClient({
          auth: {
            credentials: {clientId: "client-id", clientSecret: "client-secret"},
            refreshOn401: true,
            tokenUrl: `${server.baseURL}/oauth/token`,
            type: "oauth2",
          },
          baseURL: server.baseURL,
        });
        await client.axios.get("/widgets");
        await client.axios.get("/widgets");
        expect(seenAuthHeaders).toEqual(["Bearer oauth-token-1", "Bearer oauth-token-1"]);
        expect(state.tokenFetches).toBe(1);
      } finally {
        await server.close();
      }
    });

    it("refreshes the token and retries exactly once on a 401", async () => {
      const state = {tokenFetches: 0, validToken: "stale-token"};
      const server = await startTestServer((app) => {
        configureOauthServer(app, state);
        app.get("/widgets", (req, res) => {
          if (req.headers.authorization === "Bearer fresh-token") {
            res.json({ok: true});
            return;
          }
          // Invalidate the stale token server-side so the refresh fetches a good one.
          state.validToken = "fresh-token";
          res.status(401).json({message: "expired"});
        });
      });
      try {
        const client = createAuthenticatedClient({
          auth: {
            credentials: {clientId: "client-id", clientSecret: "client-secret"},
            refreshOn401: true,
            tokenUrl: `${server.baseURL}/oauth/token`,
            type: "oauth2",
          },
          baseURL: server.baseURL,
        });
        const response = await client.axios.get("/widgets");
        expect(response.data.ok).toBe(true);
        expect(state.tokenFetches).toBe(2);
      } finally {
        await server.close();
      }
    });

    it("propagates a persistent 401 after a single refresh attempt", async () => {
      const state = {tokenFetches: 0, validToken: "always-stale"};
      let widgetRequests = 0;
      const server = await startTestServer((app) => {
        configureOauthServer(app, state);
        app.get("/widgets", (_req, res) => {
          widgetRequests += 1;
          res.status(401).json({message: "still expired"});
        });
      });
      try {
        const client = createAuthenticatedClient({
          auth: {
            credentials: {clientId: "client-id", clientSecret: "client-secret"},
            refreshOn401: true,
            tokenUrl: `${server.baseURL}/oauth/token`,
            type: "oauth2",
          },
          baseURL: server.baseURL,
        });
        let caught: unknown;
        try {
          await client.axios.get("/widgets");
        } catch (error) {
          caught = error;
        }
        expect(isAxiosError(caught)).toBe(true);
        expect((caught as AxiosError).response?.status).toBe(401);
        expect(widgetRequests).toBe(2);
        expect(state.tokenFetches).toBe(2);
      } finally {
        await server.close();
      }
    });
  });

  describe("retry policy", () => {
    const NO_AUTH = {getToken: async () => "t", type: "bearer"} as const;

    it("retries an idempotent GET on 5xx and succeeds within maxAttempts", async () => {
      let attempts = 0;
      const server = await startTestServer((app) => {
        app.get("/flaky", (_req, res) => {
          attempts += 1;
          if (attempts < 3) {
            res.status(500).json({message: "boom"});
            return;
          }
          res.json({ok: true});
        });
      });
      try {
        const client = createAuthenticatedClient({
          auth: NO_AUTH,
          baseURL: server.baseURL,
          retry: FAST_RETRY,
        });
        const response = await client.axios.get("/flaky");
        expect(response.data.ok).toBe(true);
        expect(attempts).toBe(3);
      } finally {
        await server.close();
      }
    });

    it("retries a GET on 429 rate limiting", async () => {
      let attempts = 0;
      const server = await startTestServer((app) => {
        app.get("/limited", (_req, res) => {
          attempts += 1;
          if (attempts === 1) {
            res.set("Retry-After", "0").status(429).json({message: "slow down"});
            return;
          }
          res.json({ok: true});
        });
      });
      try {
        const client = createAuthenticatedClient({
          auth: NO_AUTH,
          baseURL: server.baseURL,
          retry: FAST_RETRY,
        });
        const response = await client.axios.get("/limited");
        expect(response.data.ok).toBe(true);
        expect(attempts).toBe(2);
      } finally {
        await server.close();
      }
    });

    it("rejects with the original error once maxAttempts is exhausted", async () => {
      let attempts = 0;
      const server = await startTestServer((app) => {
        app.get("/down", (_req, res) => {
          attempts += 1;
          res.status(503).json({message: "unavailable"});
        });
      });
      try {
        const client = createAuthenticatedClient({
          auth: NO_AUTH,
          baseURL: server.baseURL,
          retry: {...FAST_RETRY, maxAttempts: 2},
        });
        let caught: unknown;
        try {
          await client.axios.get("/down");
        } catch (error) {
          caught = error;
        }
        expect(isAxiosError(caught)).toBe(true);
        expect((caught as AxiosError).response?.status).toBe(503);
        expect(attempts).toBe(2);
      } finally {
        await server.close();
      }
    });

    it("does not retry a POST by default even on 5xx", async () => {
      let attempts = 0;
      const server = await startTestServer((app) => {
        app.post("/orders", (_req, res) => {
          attempts += 1;
          res.status(500).json({message: "boom"});
        });
      });
      try {
        const client = createAuthenticatedClient({
          auth: NO_AUTH,
          baseURL: server.baseURL,
          retry: FAST_RETRY,
        });
        let caught: unknown;
        try {
          await client.axios.post("/orders", {widget: 1});
        } catch (error) {
          caught = error;
        }
        expect(isAxiosError(caught)).toBe(true);
        expect(attempts).toBe(1);
      } finally {
        await server.close();
      }
    });

    it("retries a POST when the request opts in with retryUnsafe", async () => {
      let attempts = 0;
      const server = await startTestServer((app) => {
        app.post("/orders", (_req, res) => {
          attempts += 1;
          if (attempts === 1) {
            res.status(500).json({message: "boom"});
            return;
          }
          res.json({ok: true});
        });
      });
      try {
        const client = createAuthenticatedClient({
          auth: NO_AUTH,
          baseURL: server.baseURL,
          retry: FAST_RETRY,
        });
        const response = await client.axios.post("/orders", {widget: 1}, {retryUnsafe: true});
        expect(response.data.ok).toBe(true);
        expect(attempts).toBe(2);
      } finally {
        await server.close();
      }
    });

    it("does not retry non-retryable classifications like validation errors", async () => {
      let attempts = 0;
      const server = await startTestServer((app) => {
        app.get("/bad", (_req, res) => {
          attempts += 1;
          res.status(400).json({message: "bad request"});
        });
      });
      try {
        const client = createAuthenticatedClient({
          auth: NO_AUTH,
          baseURL: server.baseURL,
          retry: FAST_RETRY,
        });
        let caught: unknown;
        try {
          await client.axios.get("/bad");
        } catch (error) {
          caught = error;
        }
        expect((caught as AxiosError).response?.status).toBe(400);
        expect(attempts).toBe(1);
      } finally {
        await server.close();
      }
    });
  });
});

describe("createAuthenticatedClient hardening", () => {
  it("rejects without looping when the oauth2 token endpoint itself returns 401", async () => {
    let tokenRequests = 0;
    const server = await startTestServer((app) => {
      app.post("/oauth/token", (_req, res) => {
        tokenRequests += 1;
        res.status(401).json({message: "invalid client credentials"});
      });
      app.get("/widgets", (_req, res) => {
        res.json({ok: true});
      });
    });
    try {
      const client = createAuthenticatedClient({
        auth: {
          credentials: {clientId: "bad", clientSecret: "creds"},
          refreshOn401: true,
          tokenUrl: `${server.baseURL}/oauth/token`,
          type: "oauth2",
        },
        baseURL: server.baseURL,
      });
      let caught: unknown;
      try {
        await client.axios.get("/widgets");
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(Error);
      expect((caught as Error).message).toContain("token fetch");
      expect(tokenRequests).toBe(1);
    } finally {
      await server.close();
    }
  });

  it("rejects clearly when the token response has no access_token", async () => {
    const server = await startTestServer((app) => {
      app.post("/oauth/token", (_req, res) => {
        res.json({unexpected: "shape"});
      });
    });
    try {
      const client = createAuthenticatedClient({
        auth: {
          credentials: {clientId: "client-id", clientSecret: "client-secret"},
          refreshOn401: true,
          tokenUrl: `${server.baseURL}/oauth/token`,
          type: "oauth2",
        },
        baseURL: server.baseURL,
      });
      let caught: unknown;
      try {
        await client.axios.get("/widgets");
      } catch (error) {
        caught = error;
      }
      expect((caught as Error).message).toContain("access_token");
    } finally {
      await server.close();
    }
  });

  it("shares a single token fetch across concurrent first requests", async () => {
    const server = await startTestServer((app) => {
      app.get("/widgets", (_req, res) => {
        res.json({ok: true});
      });
    });
    try {
      let tokenFetches = 0;
      const client = createAuthenticatedClient({
        auth: {
          getToken: async () => {
            tokenFetches += 1;
            await new Promise((resolve) => setTimeout(resolve, 5));
            return "token-shared";
          },
          type: "bearer",
        },
        baseURL: server.baseURL,
      });
      await Promise.all([client.axios.get("/widgets"), client.axios.get("/widgets")]);
      expect(tokenFetches).toBe(1);
    } finally {
      await server.close();
    }
  });

  it("retries network errors and logs the retry attempts", async () => {
    const server = await startTestServer(() => {});
    const {baseURL} = server;
    await server.close();
    const {logger, entries} = createRecordingLogger();
    const client = createAuthenticatedClient({
      auth: {getToken: async () => "t", type: "bearer"},
      baseURL,
      logger,
      retry: {baseDelayMs: 1, maxAttempts: 2},
    });
    let caught: unknown;
    try {
      await client.axios.get("/gone");
    } catch (error) {
      caught = error;
    }
    expect(isAxiosError(caught)).toBe(true);
    const retryLogs = entries.filter((entry) => entry.msg.includes("retrying attempt"));
    expect(retryLogs).toHaveLength(1);
    expect(retryLogs[0].msg).toContain("attempt 2/2");
    expect(retryLogs[0].msg).toContain("network");
  });

  it("prefers a numeric Retry-After header over backoff", async () => {
    let attempts = 0;
    const server = await startTestServer((app) => {
      app.get("/limited", (_req, res) => {
        attempts += 1;
        if (attempts === 1) {
          res.set("Retry-After", "0").status(429).json({message: "slow down"});
          return;
        }
        res.json({ok: true});
      });
    });
    try {
      const {logger, entries} = createRecordingLogger();
      const client = createAuthenticatedClient({
        auth: {getToken: async () => "t", type: "bearer"},
        baseURL: server.baseURL,
        logger,
        // A base delay far above the Retry-After value: if backoff were used the log
        // would show >=100ms, so "in 0ms" proves the header took precedence.
        retry: {baseDelayMs: 100},
      });
      await client.axios.get("/limited");
      const retryLog = entries.find((entry) => entry.msg.includes("retrying attempt"));
      expect(retryLog?.msg).toContain("in 0ms");
    } finally {
      await server.close();
    }
  });

  it("falls back to backoff for a non-numeric Retry-After header", async () => {
    let attempts = 0;
    const server = await startTestServer((app) => {
      app.get("/limited", (_req, res) => {
        attempts += 1;
        if (attempts === 1) {
          res
            .set("Retry-After", "Wed, 21 Oct 2015 07:28:00 GMT")
            .status(429)
            .json({message: "slow down"});
          return;
        }
        res.json({ok: true});
      });
    });
    try {
      const {logger, entries} = createRecordingLogger();
      const client = createAuthenticatedClient({
        auth: {getToken: async () => "t", type: "bearer"},
        baseURL: server.baseURL,
        logger,
        retry: FAST_RETRY,
      });
      await client.axios.get("/limited");
      const retryLog = entries.find((entry) => entry.msg.includes("retrying attempt"));
      expect(retryLog?.msg).toMatch(/in [1-9]\d*ms/);
    } finally {
      await server.close();
    }
  });

  it("caps an excessive Retry-After header at the delay ceiling", async () => {
    let attempts = 0;
    const server = await startTestServer((app) => {
      app.get("/limited", (_req, res) => {
        attempts += 1;
        if (attempts === 1) {
          res.set("Retry-After", "3600").status(429).json({message: "slow down"});
          return;
        }
        res.json({ok: true});
      });
    });
    try {
      const {logger, entries} = createRecordingLogger();
      const client = createAuthenticatedClient({
        auth: {getToken: async () => "t", type: "bearer"},
        baseURL: server.baseURL,
        logger,
        retry: {...FAST_RETRY, maxDelayMs: 2},
      });
      await client.axios.get("/limited");
      const retryLog = entries.find((entry) => entry.msg.includes("retrying attempt"));
      expect(retryLog?.msg).toContain("in 2ms");
    } finally {
      await server.close();
    }
  });

  it("honors a custom retryOn list", async () => {
    let attempts = 0;
    const server = await startTestServer((app) => {
      app.get("/missing", (_req, res) => {
        attempts += 1;
        if (attempts === 1) {
          res.status(404).json({message: "not here yet"});
          return;
        }
        res.json({ok: true});
      });
    });
    try {
      const client = createAuthenticatedClient({
        auth: {getToken: async () => "t", type: "bearer"},
        baseURL: server.baseURL,
        retry: {...FAST_RETRY, retryOn: ["notFound"]},
      });
      const response = await client.axios.get("/missing");
      expect(response.data.ok).toBe(true);
      expect(attempts).toBe(2);
    } finally {
      await server.close();
    }
  });

  it("uses the apiName option in normalized retry context instead of the baseURL", async () => {
    let attempts = 0;
    const server = await startTestServer((app) => {
      app.get("/flaky", (_req, res) => {
        attempts += 1;
        if (attempts === 1) {
          res.status(500).json({message: "boom"});
          return;
        }
        res.json({ok: true});
      });
    });
    try {
      const {logger, entries} = createRecordingLogger();
      const client = createAuthenticatedClient({
        apiName: "widgetService",
        auth: {getToken: async () => "t", type: "bearer"},
        baseURL: server.baseURL,
        logger,
        retry: FAST_RETRY,
      });
      await client.axios.get("/flaky");
      const retryLog = entries.find((entry) => entry.msg.includes("retrying attempt"));
      expect(retryLog?.msg).toContain("[widgetService]");
    } finally {
      await server.close();
    }
  });
});
