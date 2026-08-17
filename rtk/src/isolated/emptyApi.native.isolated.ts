/**
 * Isolated tests for the native (SecureStore) token storage paths of emptyApi.ts.
 * The web paths are covered by emptyApi.isolated.ts.
 */
import {beforeEach, describe, expect, it, mock} from "bun:test";

mock.module("react-native", () => ({
  Platform: {OS: "ios"},
  StyleSheet: {create: (styles: unknown) => styles},
}));
mock.module("../platform", () => ({IsWeb: false}));

const secureStore = new Map<string, string>();

mock.module("expo-secure-store", () => ({
  deleteItemAsync: async (key: string) => {
    secureStore.delete(key);
  },
  getItemAsync: async (key: string) => secureStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    secureStore.set(key, value);
  },
}));

mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async () => {
      throw new Error("AsyncStorage should not be used on native");
    },
    removeItem: async () => {},
    setItem: async () => {
      throw new Error("AsyncStorage should not be used on native");
    },
  },
}));

mock.module("expo-constants", () => ({
  default: {expoConfig: {extra: {}, version: "9.9.9"}},
}));

const axiosDefaults = {headers: {common: {} as Record<string, string>}};
const axiosPost = mock(async () => ({
  data: {data: {refreshToken: "native-refresh", token: "native-auth"}},
}));

mock.module("axios", () => ({
  default: {
    defaults: axiosDefaults,
    isAxiosError: () => false,
    post: axiosPost,
  },
}));

mock.module("axios-retry", () => ({
  default: Object.assign(() => {}, {exponentialDelay: () => 0}),
}));

mock.module("../constants", () => ({
  AUTH_DEBUG: false,
  baseUrl: "http://localhost:4000",
  LOGOUT_ACTION_TYPE: "auth/logout",
  TOKEN_REFRESHED_SUCCESS: "auth/tokenRefreshedSuccess",
}));

mock.module("../authSlice", () => ({
  generateProfileEndpoints: () => ({}),
  getAuthToken: async () => secureStore.get("AUTH_TOKEN") ?? null,
}));

mock.module("../offlineGate", () => ({
  shouldDeferOfflineMutation: () => false,
}));

const fetchMock = mock(
  async (_input: unknown, _init?: unknown) =>
    new Response(JSON.stringify({data: {ok: true}}), {
      headers: {"content-type": "application/json"},
      status: 200,
    })
);
globalThis.fetch = fetchMock as unknown as typeof fetch;

const {getTokenExpirationTimes, refreshAuthToken, staggeredBaseQuery} = await import("../emptyApi");

const createApiArg = () =>
  ({
    abort: () => {},
    dispatch: (action: {type: string}) => action,
    endpoint: "getTodos",
    extra: undefined,
    forced: false,
    getState: () => ({}),
    signal: new AbortController().signal,
    type: "query",
  }) as unknown as Parameters<typeof staggeredBaseQuery>[1];

const base64Url = (value: object): string =>
  Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const makeToken = (secondsFromNow: number): string =>
  `${base64Url({alg: "HS256"})}.${base64Url({
    exp: Math.floor(Date.now() / 1000) + secondsFromNow,
  })}.signature`;

beforeEach(() => {
  secureStore.clear();
  axiosPost.mockClear();
  fetchMock.mockClear();
});

describe("native token storage", () => {
  it("reads expiration times from SecureStore", async () => {
    secureStore.set("AUTH_TOKEN", makeToken(300));
    secureStore.set("REFRESH_TOKEN", makeToken(600));

    const {authRemainingSecs, refreshRemainingSecs} = await getTokenExpirationTimes();

    expect(authRemainingSecs).toBeGreaterThan(290);
    expect(refreshRemainingSecs).toBeGreaterThan(590);
  });

  it("writes refreshed tokens back to SecureStore", async () => {
    secureStore.set("AUTH_TOKEN", makeToken(10));
    secureStore.set("REFRESH_TOKEN", makeToken(600));

    await refreshAuthToken();

    expect(secureStore.get("AUTH_TOKEN")).toBe("native-auth");
    expect(secureStore.get("REFRESH_TOKEN")).toBe("native-refresh");
  });

  it("performs a request with the no-op debug logger when AUTH_DEBUG is off", async () => {
    secureStore.set("AUTH_TOKEN", makeToken(3600));
    secureStore.set("REFRESH_TOKEN", makeToken(7200));

    const result = await staggeredBaseQuery(
      "/todos" as never,
      createApiArg() as never,
      {maxRetries: 0} as never
    );

    expect(result.data).toEqual({ok: true});
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const request = fetchMock.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://localhost:4000/todos");
    expect(request.headers.get("authorization")).toBe(`Bearer ${secureStore.get("AUTH_TOKEN")}`);
  });
});
