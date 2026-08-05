/**
 * Isolated tests for emptyApi.ts.
 *
 * The module pulls in axios, expo-secure-store and AsyncStorage at import
 * time, so the mocks live in their own process to avoid leaking into the rest
 * of the package test run.
 */
import {beforeEach, describe, expect, it, mock} from "bun:test";

mock.module("react-native", () => ({
  Platform: {OS: "web"},
  StyleSheet: {create: (styles: unknown) => styles},
}));
mock.module("../platform", () => ({IsWeb: true}));

if (typeof globalThis.window === "undefined") {
  (globalThis as {window?: unknown}).window = {};
}

const storage = new Map<string, string>();

mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string) => storage.get(key) ?? null,
    removeItem: async (key: string) => {
      storage.delete(key);
    },
    setItem: async (key: string, value: string) => {
      storage.set(key, value);
    },
  },
}));

mock.module("expo-secure-store", () => ({
  deleteItemAsync: async () => {},
  getItemAsync: async () => null,
  setItemAsync: async () => {},
}));

mock.module("expo-constants", () => ({
  default: {expoConfig: {extra: {AUTH_DEBUG: true}, version: "9.9.9"}},
}));

interface AxiosErrorShape {
  code?: string;
  isAxiosError: true;
  message: string;
  status?: number;
}

let axiosPostResult: unknown = {data: {data: {refreshToken: "new-refresh", token: "new-auth"}}};
let axiosPostError: unknown;
const axiosDefaults = {headers: {common: {} as Record<string, string>}};
const axiosPost = mock(async () => {
  if (axiosPostError) {
    throw axiosPostError;
  }
  return axiosPostResult;
});

mock.module("axios", () => ({
  default: {
    defaults: axiosDefaults,
    isAxiosError: (error: unknown): error is AxiosErrorShape =>
      Boolean((error as AxiosErrorShape | undefined)?.isAxiosError),
    post: axiosPost,
  },
}));

mock.module("axios-retry", () => ({
  default: Object.assign(() => {}, {exponentialDelay: () => 0}),
}));

mock.module("../constants", () => ({
  AUTH_DEBUG: true,
  baseUrl: "http://localhost:4000",
  LOGOUT_ACTION_TYPE: "auth/logout",
  TOKEN_REFRESHED_SUCCESS: "auth/tokenRefreshedSuccess",
}));

mock.module("../authSlice", () => ({
  generateProfileEndpoints: () => ({}),
  getAuthToken: async () => storage.get("AUTH_TOKEN") ?? null,
}));

let deferOfflineMutation = false;
mock.module("../offlineGate", () => ({
  shouldDeferOfflineMutation: () => deferOfflineMutation,
}));

const {configureStore} = await import("@reduxjs/toolkit");

const {
  emptySplitApi,
  getBaseQuery,
  getFriendlyExpirationInfo,
  getTokenExpirationTimes,
  refreshAuthToken,
  shouldShowStillThereModal,
  staggeredBaseQuery,
} = await import("../emptyApi");

const base64Url = (value: object): string =>
  Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/** Builds a syntactically valid JWT expiring `secondsFromNow` from now. */
const makeToken = (secondsFromNow: number): string =>
  `${base64Url({alg: "HS256"})}.${base64Url({
    exp: Math.floor(Date.now() / 1000) + secondsFromNow,
  })}.signature`;

const setTokens = ({auth, refresh}: {auth: number; refresh: number}): void => {
  storage.set("AUTH_TOKEN", makeToken(auth));
  storage.set("REFRESH_TOKEN", makeToken(refresh));
};

interface FetchResponseOptions {
  body?: unknown;
  status?: number;
}

let fetchResponses: FetchResponseOptions[] = [];
const fetchMock = mock(async (_input?: unknown, _init?: unknown) => {
  const next = fetchResponses.shift() ?? {body: {data: {ok: true}}, status: 200};
  return new Response(next.status === 204 ? null : JSON.stringify(next.body ?? {}), {
    headers: {"content-type": "application/json"},
    status: next.status ?? 200,
  });
});
globalThis.fetch = fetchMock as unknown as typeof fetch;

const dispatched: {type: string}[] = [];

const createApiArg = ({
  endpoint = "getTodos",
  type = "query",
}: {
  endpoint?: string;
  type?: "query" | "mutation";
} = {}) =>
  ({
    abort: () => {},
    dispatch: (action: {type: string}) => {
      dispatched.push(action);
      return action;
    },
    endpoint,
    extra: undefined,
    forced: false,
    getState: () => ({}),
    signal: new AbortController().signal,
    type,
  }) as unknown as Parameters<typeof getBaseQuery>[1];

const runQuery = async (
  args: string | {url: string; method?: string},
  apiArg = createApiArg(),
  extraOptions: Record<string, unknown> = {maxRetries: 0}
) => {
  return staggeredBaseQuery(args as never, apiArg as never, extraOptions as never);
};

const dispatchedTypes = (): string[] => dispatched.map((action) => action.type);

beforeEach(() => {
  storage.clear();
  dispatched.length = 0;
  fetchResponses = [];
  fetchMock.mockClear();
  axiosPost.mockClear();
  axiosPostError = undefined;
  axiosPostResult = {data: {data: {refreshToken: "new-refresh", token: "new-auth"}}};
  deferOfflineMutation = false;
});

/** Runs `body` with `window` removed, to exercise the SSR branches. */
const withoutWindow = async (body: () => Promise<void>): Promise<void> => {
  const original = globalThis.window;
  (globalThis as {window?: unknown}).window = undefined;
  try {
    await body();
  } finally {
    (globalThis as {window?: unknown}).window = original;
  }
};

describe("getTokenExpirationTimes", () => {
  it("returns undefined when no tokens are stored", async () => {
    expect(await getTokenExpirationTimes()).toEqual({
      authRemainingSecs: undefined,
      refreshRemainingSecs: undefined,
    });
  });

  it("returns the remaining seconds for both tokens", async () => {
    setTokens({auth: 300, refresh: 600});
    const {authRemainingSecs, refreshRemainingSecs} = await getTokenExpirationTimes();
    expect(authRemainingSecs).toBeGreaterThan(290);
    expect(refreshRemainingSecs).toBeGreaterThan(590);
  });

  it("skips storage when rendering server side", async () => {
    setTokens({auth: 300, refresh: 600});
    await withoutWindow(async () => {
      expect(await getTokenExpirationTimes()).toEqual({
        authRemainingSecs: undefined,
        refreshRemainingSecs: undefined,
      });
    });
  });
});

describe("getFriendlyExpirationInfo", () => {
  it("reports when no tokens are available", async () => {
    expect(await getFriendlyExpirationInfo()).toBe("No tokens available");
  });

  it("describes valid tokens", async () => {
    setTokens({auth: 300, refresh: 600});
    const message = await getFriendlyExpirationInfo();
    expect(message).toContain("Auth token expires in");
    expect(message).toContain("Refresh token expires in");
  });

  it("describes expired tokens", async () => {
    setTokens({auth: -300, refresh: -600});
    const message = await getFriendlyExpirationInfo();
    expect(message).toContain("Auth token expired");
    expect(message).toContain("Refresh token expired");
  });
});

describe("shouldShowStillThereModal", () => {
  it("returns false when there is no refresh token", async () => {
    expect(await shouldShowStillThereModal()).toBe(false);
  });

  it("returns true when the refresh token is nearly expired", async () => {
    setTokens({auth: 30, refresh: 30});
    expect(await shouldShowStillThereModal()).toBe(true);
  });

  it("returns false when the refresh token has plenty of time left", async () => {
    setTokens({auth: 300, refresh: 3600});
    expect(await shouldShowStillThereModal()).toBe(false);
  });
});

describe("refreshAuthToken", () => {
  it("throws when there is no refresh token", async () => {
    await expect(refreshAuthToken()).rejects.toThrow("no refresh token found");
  });

  it("stores the new tokens and sets the axios auth header", async () => {
    setTokens({auth: 10, refresh: 600});
    await refreshAuthToken();

    expect(storage.get("AUTH_TOKEN")).toBe("new-auth");
    expect(storage.get("REFRESH_TOKEN")).toBe("new-refresh");
    expect(axiosDefaults.headers.common.Authorization).toBe("Bearer new-auth");
  });

  it("throws when the response has no data", async () => {
    setTokens({auth: 10, refresh: 600});
    axiosPostResult = {data: {}};
    await expect(refreshAuthToken()).rejects.toThrow("refresh token API request failed");
  });

  it("throws when the response is missing the tokens", async () => {
    setTokens({auth: 10, refresh: 600});
    axiosPostResult = {data: {data: {somethingElse: true}}};
    await expect(refreshAuthToken()).rejects.toThrow(
      "refresh token API request didn't return data"
    );
  });

  it("throws when rendering server side because no token can be read", async () => {
    setTokens({auth: 10, refresh: 600});
    await withoutWindow(async () => {
      await expect(refreshAuthToken()).rejects.toThrow("no refresh token found");
    });
  });
});

describe("getBaseQuery", () => {
  it("returns null for 204 responses", async () => {
    fetchResponses = [{status: 204}];
    const result = await getBaseQuery("/todos", createApiArg(), {}, "token");
    expect(result.data).toBeNull();
  });

  it("returns the full payload for list responses", async () => {
    fetchResponses = [{body: {data: [{_id: "1"}], more: false, page: 1, total: 1}}];
    const result = await getBaseQuery("/todos", createApiArg(), {}, "token");
    expect(result.data).toMatchObject({more: false, total: 1});
  });

  it("unwraps data for single document responses", async () => {
    fetchResponses = [{body: {data: {_id: "1"}}}];
    const result = await getBaseQuery("/todos/1", createApiArg(), {}, "token");
    expect(result.data).toEqual({_id: "1"});
  });

  it("returns the raw body when there is no data key", async () => {
    fetchResponses = [{body: {status: "ok"}}];
    const result = await getBaseQuery("/health", createApiArg(), {}, "token");
    expect(result.data).toEqual({status: "ok"});
  });

  it("serializes nested query params", async () => {
    fetchResponses = [{body: {data: {}}}];
    await getBaseQuery(
      {params: {status: {$in: ["open", "closed"]}}, url: "/todos"},
      createApiArg(),
      {},
      "token"
    );

    const request = fetchMock.mock.calls[0]?.[0] as unknown as Request;
    expect(decodeURIComponent(request.url)).toContain("status[$in][0]=open");
  });

  it("sends the auth, version and platform headers", async () => {
    fetchResponses = [{body: {data: {}}}];
    await getBaseQuery("/todos", createApiArg(), {}, "my-token");

    const request = fetchMock.mock.calls[0]?.[0] as unknown as Request;
    expect(request.headers.get("authorization")).toBe("Bearer my-token");
    expect(request.headers.get("app-version")).toBe("9.9.9");
    expect(request.headers.get("app-platform")).toBe("web");
  });
});

describe("staggeredBaseQuery", () => {
  it("fails fast for mutations deferred while offline", async () => {
    deferOfflineMutation = true;
    const result = await runQuery(
      "/todos",
      createApiArg({endpoint: "postTodos", type: "mutation"})
    );

    expect(result.error).toMatchObject({status: "FETCH_ERROR"});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes login requests through without token validation", async () => {
    fetchResponses = [{body: {data: {token: "abc"}}}];
    const result = await runQuery(
      "/auth/login",
      createApiArg({endpoint: "emailLogin", type: "mutation"})
    );

    expect(result.data).toEqual({token: "abc"});
    expect(dispatchedTypes()).not.toContain("auth/logout");
  });

  it("logs out when there is no token", async () => {
    const result = await runQuery("/todos");

    expect(result.error).toMatchObject({status: "FETCH_ERROR"});
    expect(dispatchedTypes()).toContain("auth/logout");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("logs out when both tokens are expired", async () => {
    setTokens({auth: -10, refresh: -10});
    const result = await runQuery("/todos");

    expect(result.error).toMatchObject({error: "Auth and refresh tokens are expired"});
    expect(dispatchedTypes()).toContain("auth/logout");
  });

  it("refreshes the token when it is close to expiring", async () => {
    setTokens({auth: 30, refresh: 3600});
    fetchResponses = [{body: {data: {ok: true}}}];

    const result = await runQuery("/todos");

    expect(axiosPost).toHaveBeenCalled();
    expect(dispatchedTypes()).toContain("auth/tokenRefreshedSuccess");
    expect(result.data).toEqual({ok: true});
  });

  it("continues with the current token on a network error while refreshing", async () => {
    setTokens({auth: 30, refresh: 3600});
    axiosPostError = {code: "ERR_NETWORK", isAxiosError: true, message: "offline"};
    fetchResponses = [{body: {data: {ok: true}}}];

    const result = await runQuery("/todos");

    expect(result.data).toEqual({ok: true});
    expect(dispatchedTypes()).not.toContain("auth/logout");
  });

  it("logs out when the refresh request is rejected with a 401", async () => {
    setTokens({auth: 30, refresh: 3600});
    axiosPostError = {isAxiosError: true, message: "unauthorized", status: 401};

    const result = await runQuery("/todos");

    expect(result.error).toMatchObject({error: "Token refresh failed with 401"});
    expect(dispatchedTypes()).toContain("auth/logout");
  });

  it("logs out when refreshing fails for any other reason", async () => {
    setTokens({auth: 30, refresh: 3600});
    axiosPostError = new Error("boom");

    const result = await runQuery("/todos");

    expect(result.error).toMatchObject({error: "Failed to refresh token: boom"});
    expect(dispatchedTypes()).toContain("auth/logout");
  });

  it("performs the request with a valid token", async () => {
    setTokens({auth: 3600, refresh: 7200});
    fetchResponses = [{body: {data: {ok: true}}}];

    const result = await runQuery("/todos");

    expect(result.data).toEqual({ok: true});
    expect(axiosPost).not.toHaveBeenCalled();
  });

  it("refreshes and retries once after a 401 response", async () => {
    setTokens({auth: 3600, refresh: 7200});
    fetchResponses = [
      {body: {message: "expired"}, status: 401},
      {body: {data: {ok: true}}, status: 200},
    ];

    const result = await runQuery("/todos");

    expect(axiosPost).toHaveBeenCalled();
    expect(dispatchedTypes()).toContain("auth/tokenRefreshedSuccess");
    expect(result.data).toEqual({ok: true});
  });

  it("logs out when the retry after a 401 cannot refresh the token", async () => {
    setTokens({auth: 3600, refresh: 7200});
    fetchResponses = [{body: {message: "expired"}, status: 401}];
    axiosPostError = new Error("nope");

    const result = await runQuery("/todos");

    expect(result.error).toMatchObject({status: 401});
    expect(dispatchedTypes()).toContain("auth/logout");
  });

  it("waits for an in-flight refresh instead of refreshing twice on 401", async () => {
    setTokens({auth: 3600, refresh: 7200});
    fetchResponses = [
      {body: {message: "expired"}, status: 401},
      {body: {message: "expired"}, status: 401},
      {body: {data: {ok: true}}, status: 200},
      {body: {data: {ok: true}}, status: 200},
    ];
    axiosPost.mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {data: {data: {refreshToken: "new-refresh", token: "new-auth"}}};
    });

    const [first, second] = await Promise.all([runQuery("/todos"), runQuery("/todos")]);

    expect(axiosPost).toHaveBeenCalledTimes(1);
    expect(first.data ?? second.data).toEqual({ok: true});
  });

  it("does not retry failed mutations", async () => {
    setTokens({auth: 3600, refresh: 7200});
    fetchResponses = [{body: {message: "bad request"}, status: 400}];

    const result = await runQuery(
      {method: "POST", url: "/todos"},
      createApiArg({endpoint: "postTodos", type: "mutation"}),
      {}
    );

    expect(result.error).toMatchObject({status: 400});
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("emptySplitApi", () => {
  it("queries the version check endpoint", async () => {
    setTokens({auth: 3600, refresh: 7200});
    fetchResponses = [{body: {status: "ok"}}];

    const store = configureStore({
      middleware: (getDefault) => getDefault().concat(emptySplitApi.middleware),
      reducer: {[emptySplitApi.reducerPath]: emptySplitApi.reducer},
    });

    const result = await store.dispatch(
      emptySplitApi.endpoints.getVersionCheck.initiate({platform: "web", version: 12})
    );

    expect(result.data).toEqual({status: "ok"});
    const request = fetchMock.mock.calls[0]?.[0] as unknown as Request;
    expect(request.url).toContain("/version-check?platform=web&version=12");
  });
});
