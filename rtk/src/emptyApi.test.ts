import {afterEach, beforeEach, describe, it, mock} from "bun:test";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import {assert} from "chai";

import {
  getBaseQuery,
  getFriendlyExpirationInfo,
  getTokenExpirationTimes,
  refreshAuthToken,
  shouldShowStillThereModal,
  staggeredBaseQuery,
} from "./emptyApi";
import {configureOfflineMutationEndpoints} from "./offlineGate";

// Force IsWeb=true regardless of load order with the native test files.
mock.module("./platform", () => ({IsWeb: true}));

type FetchArgs = Parameters<typeof fetch>;
type FetchHandler = (input: FetchArgs[0], init: FetchArgs[1]) => Response;

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    headers: {"Content-Type": "application/json"},
    status,
  });

const nowSecs = (): number => Math.floor(Date.now() / 1000);

const makeToken = (expOffsetSecs: number): string => {
  const payload = Buffer.from(JSON.stringify({exp: nowSecs() + expOffsetSecs})).toString(
    "base64url"
  );
  return `header.${payload}.signature`;
};

const originalFetch = global.fetch;
const originalGetItem = AsyncStorage.getItem;
const originalSetItem = AsyncStorage.setItem;
const originalPost = axios.post;
const originalIsAxiosError = axios.isAxiosError;

let storage: Record<string, string | null>;

const setFetch = (handler: FetchHandler): void => {
  global.fetch = mock((input: FetchArgs[0], init: FetchArgs[1]) =>
    Promise.resolve(handler(input, init))
  ) as unknown as typeof fetch;
};

interface TestApi {
  type: "query" | "mutation";
  endpoint: string;
  getState: () => unknown;
  dispatch: ReturnType<typeof mock>;
  signal: AbortSignal;
  abort: () => void;
  forced?: boolean;
  extra: unknown;
}

const makeApi = (overrides: Partial<TestApi> = {}): TestApi => ({
  abort: () => {},
  dispatch: mock(() => {}),
  endpoint: "getThing",
  extra: undefined,
  getState: () => ({}),
  signal: new AbortController().signal,
  type: "query",
  ...overrides,
});

const globalWithWindow = globalThis as {window?: unknown};
let originalWindow: unknown;

beforeEach(() => {
  storage = {};
  AsyncStorage.getItem = (async (key: string): Promise<string | null> =>
    storage[key] ?? null) as typeof AsyncStorage.getItem;
  AsyncStorage.setItem = (async (key: string, value: string): Promise<void> => {
    storage[key] = value;
  }) as typeof AsyncStorage.setItem;
  originalWindow = globalWithWindow.window;
  globalWithWindow.window = {};
  configureOfflineMutationEndpoints([]);
});

afterEach(() => {
  global.fetch = originalFetch;
  AsyncStorage.getItem = originalGetItem;
  AsyncStorage.setItem = originalSetItem;
  axios.post = originalPost;
  axios.isAxiosError = originalIsAxiosError;
  if (typeof originalWindow === "undefined") {
    delete globalWithWindow.window;
  } else {
    globalWithWindow.window = originalWindow;
  }
});

describe("getTokenExpirationTimes", () => {
  it("returns undefined values when tokens are missing", async () => {
    const result = await getTokenExpirationTimes();
    assert.deepEqual(result, {
      authRemainingSecs: undefined,
      refreshRemainingSecs: undefined,
    });
  });

  it("computes remaining seconds from decoded tokens", async () => {
    storage.AUTH_TOKEN = makeToken(300);
    storage.REFRESH_TOKEN = makeToken(6000);
    const {authRemainingSecs, refreshRemainingSecs} = await getTokenExpirationTimes();
    assert.isDefined(authRemainingSecs);
    assert.isDefined(refreshRemainingSecs);
    assert.approximately(authRemainingSecs as number, 300, 5);
    assert.approximately(refreshRemainingSecs as number, 6000, 5);
  });
});

describe("getFriendlyExpirationInfo", () => {
  it("reports when no tokens are available", async () => {
    const message = await getFriendlyExpirationInfo();
    assert.equal(message, "No tokens available");
  });

  it("describes remaining time for valid tokens", async () => {
    storage.AUTH_TOKEN = makeToken(300);
    storage.REFRESH_TOKEN = makeToken(6000);
    const message = await getFriendlyExpirationInfo();
    assert.include(message, "Auth token expires in");
    assert.include(message, "Refresh token expires in");
  });

  it("describes expired tokens", async () => {
    storage.AUTH_TOKEN = makeToken(-300);
    storage.REFRESH_TOKEN = makeToken(-100);
    const message = await getFriendlyExpirationInfo();
    assert.include(message, "Auth token expired");
    assert.include(message, "Refresh token expired");
  });
});

describe("shouldShowStillThereModal", () => {
  it("returns false when there is no refresh token", async () => {
    assert.isFalse(await shouldShowStillThereModal());
  });

  it("returns true when the refresh token is close to expiring", async () => {
    storage.AUTH_TOKEN = makeToken(30);
    storage.REFRESH_TOKEN = makeToken(30);
    assert.isTrue(await shouldShowStillThereModal());
  });

  it("returns false when the refresh token has plenty of time", async () => {
    storage.AUTH_TOKEN = makeToken(6000);
    storage.REFRESH_TOKEN = makeToken(6000);
    assert.isFalse(await shouldShowStillThereModal());
  });
});

describe("refreshAuthToken", () => {
  it("throws when there is no refresh token", async () => {
    let threw = false;
    try {
      await refreshAuthToken();
    } catch (error) {
      threw = true;
      assert.include((error as Error).message, "no refresh token found");
    }
    assert.isTrue(threw);
  });

  it("stores new tokens on a successful refresh", async () => {
    storage.REFRESH_TOKEN = makeToken(6000);
    axios.post = (async () => ({
      data: {data: {refreshToken: "new-refresh", token: "new-auth"}},
    })) as unknown as typeof axios.post;

    await refreshAuthToken();

    assert.equal(storage.AUTH_TOKEN, "new-auth");
    assert.equal(storage.REFRESH_TOKEN, "new-refresh");
  });

  it("throws when the refresh response is missing tokens", async () => {
    storage.REFRESH_TOKEN = makeToken(6000);
    axios.post = (async () => ({
      data: {data: {token: "only-auth"}},
    })) as unknown as typeof axios.post;

    let threw = false;
    try {
      await refreshAuthToken();
    } catch (error) {
      threw = true;
      assert.include((error as Error).message, "didn't return data");
    }
    assert.isTrue(threw);
  });

  it("throws when the refresh response has no data envelope", async () => {
    storage.REFRESH_TOKEN = makeToken(6000);
    axios.post = (async () => ({data: {}})) as unknown as typeof axios.post;

    let threw = false;
    try {
      await refreshAuthToken();
    } catch (error) {
      threw = true;
      assert.include((error as Error).message, "failed or didn't return data");
    }
    assert.isTrue(threw);
  });
});

describe("getBaseQuery", () => {
  it("returns null for a 204 response", async () => {
    setFetch(() => new Response(null, {status: 204}));
    const result = await getBaseQuery("/thing", makeApi(), {}, "token");
    assert.isNull(result.data);
  });

  it("returns the whole payload for list responses containing `more`", async () => {
    setFetch(() => jsonResponse({data: [1, 2], more: false, total: 2}));
    const result = await getBaseQuery("/things", makeApi(), {}, "token");
    assert.deepEqual(result.data, {data: [1, 2], more: false, total: 2});
  });

  it("unwraps the data envelope for single-resource responses", async () => {
    setFetch(() => jsonResponse({data: {id: "abc"}}));
    const result = await getBaseQuery("/thing/abc", makeApi(), {}, "token");
    assert.deepEqual(result.data, {id: "abc"});
  });

  it("returns the raw payload when there is no envelope", async () => {
    setFetch(() => jsonResponse({status: "healthy"}));
    const result = await getBaseQuery("/health", makeApi(), {}, "token");
    assert.deepEqual(result.data, {status: "healthy"});
  });

  it("sets the authorization and app headers", async () => {
    let seenAuth: string | null = null;
    let seenPlatform: string | null = null;
    setFetch((input, init) => {
      const headers = new Request(input as never, init).headers;
      seenAuth = headers.get("authorization");
      seenPlatform = headers.get("app-platform");
      return jsonResponse({data: {ok: true}});
    });
    await getBaseQuery("/thing", makeApi(), {}, "my-token");
    assert.equal(seenAuth, "Bearer my-token");
    assert.equal(seenPlatform, "web");
  });
});

describe("staggeredBaseQuery", () => {
  it("passes login requests through without token validation", async () => {
    setFetch(() => jsonResponse({data: {token: "abc"}}));
    const result = await staggeredBaseQuery(
      {method: "POST", url: "/auth/login"},
      makeApi({endpoint: "emailLogin", type: "mutation"}) as never,
      {maxRetries: 0}
    );
    assert.deepEqual(result.data, {token: "abc"});
  });

  it("logs out when there is no token for a protected endpoint", async () => {
    const api = makeApi({endpoint: "getThing"});
    const result = await staggeredBaseQuery("/thing", api as never, {maxRetries: 0});
    assert.isDefined(result.error);
    assert.isTrue(
      api.dispatch.mock.calls.some((call) => (call[0] as {type: string}).type === "auth/logout")
    );
  });

  it("logs out when both tokens are expired", async () => {
    storage.AUTH_TOKEN = makeToken(-100);
    storage.REFRESH_TOKEN = makeToken(-100);
    const api = makeApi({endpoint: "getThing"});
    const result = await staggeredBaseQuery("/thing", api as never, {maxRetries: 0});
    assert.isDefined(result.error);
    assert.isTrue(
      api.dispatch.mock.calls.some((call) => (call[0] as {type: string}).type === "auth/logout")
    );
  });

  it("refreshes a nearly-expired auth token before the request", async () => {
    storage.AUTH_TOKEN = makeToken(60);
    storage.REFRESH_TOKEN = makeToken(6000);
    axios.post = (async () => ({
      data: {data: {refreshToken: makeToken(6000), token: "fresh-token"}},
    })) as unknown as typeof axios.post;
    setFetch(() => jsonResponse({data: {ok: true}}));

    const api = makeApi({endpoint: "getThing"});
    const result = await staggeredBaseQuery("/thing", api as never, {maxRetries: 0});
    assert.deepEqual(result.data, {ok: true});
    assert.isTrue(
      api.dispatch.mock.calls.some(
        (call) => (call[0] as {type: string}).type === "auth/tokenRefreshedSuccess"
      )
    );
  });

  it("continues on a network error while refreshing without logging out", async () => {
    storage.AUTH_TOKEN = makeToken(60);
    storage.REFRESH_TOKEN = makeToken(6000);
    axios.isAxiosError = (() => true) as unknown as typeof axios.isAxiosError;
    axios.post = (async () => {
      throw {code: "ERR_NETWORK", message: "network down"};
    }) as unknown as typeof axios.post;
    setFetch(() => jsonResponse({data: {ok: true}}));

    const api = makeApi({endpoint: "getThing"});
    const result = await staggeredBaseQuery("/thing", api as never, {maxRetries: 0});
    assert.deepEqual(result.data, {ok: true});
    assert.isFalse(
      api.dispatch.mock.calls.some((call) => (call[0] as {type: string}).type === "auth/logout")
    );
  });

  it("logs out on a 401 while refreshing a nearly-expired token", async () => {
    storage.AUTH_TOKEN = makeToken(60);
    storage.REFRESH_TOKEN = makeToken(6000);
    axios.isAxiosError = (() => true) as unknown as typeof axios.isAxiosError;
    axios.post = (async () => {
      throw {message: "unauthorized", status: 401};
    }) as unknown as typeof axios.post;
    setFetch(() => jsonResponse({data: {ok: true}}));

    const api = makeApi({endpoint: "getThing"});
    const result = await staggeredBaseQuery("/thing", api as never, {maxRetries: 0});
    assert.isDefined(result.error);
    assert.isTrue(
      api.dispatch.mock.calls.some((call) => (call[0] as {type: string}).type === "auth/logout")
    );
  });

  it("logs out on a generic error while refreshing a nearly-expired token", async () => {
    storage.AUTH_TOKEN = makeToken(60);
    storage.REFRESH_TOKEN = makeToken(6000);
    axios.isAxiosError = (() => false) as unknown as typeof axios.isAxiosError;
    axios.post = (async () => {
      throw new Error("boom");
    }) as unknown as typeof axios.post;

    const api = makeApi({endpoint: "getThing"});
    const result = await staggeredBaseQuery("/thing", api as never, {maxRetries: 0});
    assert.isDefined(result.error);
    assert.isTrue(
      api.dispatch.mock.calls.some((call) => (call[0] as {type: string}).type === "auth/logout")
    );
  });

  it("refreshes and retries once when the request returns a 401", async () => {
    storage.AUTH_TOKEN = makeToken(6000);
    storage.REFRESH_TOKEN = makeToken(6000);
    axios.post = (async () => ({
      data: {data: {refreshToken: makeToken(6000), token: "retry-token"}},
    })) as unknown as typeof axios.post;
    let call = 0;
    setFetch(() => {
      call += 1;
      return call === 1
        ? jsonResponse({error: "unauthorized"}, 401)
        : jsonResponse({data: {ok: true}});
    });

    const api = makeApi({endpoint: "getThing"});
    const result = await staggeredBaseQuery("/thing", api as never, {maxRetries: 0});
    assert.deepEqual(result.data, {ok: true});
    assert.isTrue(
      api.dispatch.mock.calls.some(
        (call2) => (call2[0] as {type: string}).type === "auth/tokenRefreshedSuccess"
      )
    );
  });

  it("does not retry mutations that fail with a non-401 error", async () => {
    storage.AUTH_TOKEN = makeToken(6000);
    storage.REFRESH_TOKEN = makeToken(6000);
    let call = 0;
    setFetch(() => {
      call += 1;
      return jsonResponse({error: "server error"}, 500);
    });

    const api = makeApi({endpoint: "patchThing", type: "mutation"});
    const result = await staggeredBaseQuery("/thing", api as never, {maxRetries: 0});
    assert.isDefined(result.error);
    assert.equal(call, 1);
  });

  it("defers configured mutations while offline without making a request", async () => {
    storage.AUTH_TOKEN = makeToken(6000);
    storage.REFRESH_TOKEN = makeToken(6000);
    configureOfflineMutationEndpoints(["patchThing"]);
    let fetched = false;
    setFetch(() => {
      fetched = true;
      return jsonResponse({data: {ok: true}});
    });

    const api = makeApi({
      endpoint: "patchThing",
      getState: () => ({offline: {isOnline: false}}),
      type: "mutation",
    });
    const result = await staggeredBaseQuery("/thing", api as never, {maxRetries: 0});
    assert.isDefined(result.error);
    assert.isFalse(fetched);
  });
});
