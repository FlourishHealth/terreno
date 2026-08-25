/**
 * Isolated tests for the native (non-web) storage branches of emptyApi.ts.
 *
 * emptyApi.isolated.ts pins `IsWeb` to true, so the expo-secure-store paths
 * only run here, where the module graph is mocked for a native platform.
 */
import {beforeEach, describe, expect, it, mock} from "bun:test";

mock.module("react-native", () => ({
  Platform: {OS: "ios"},
  StyleSheet: {create: (styles: unknown) => styles},
}));
mock.module("../platform", () => ({IsWeb: false}));

const secureStorage = new Map<string, string>();

mock.module("expo-secure-store", () => ({
  deleteItemAsync: async (key: string) => {
    secureStorage.delete(key);
  },
  getItemAsync: async (key: string) => secureStorage.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    secureStorage.set(key, value);
  },
}));

mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async () => {
      throw new Error("AsyncStorage must not be used on native");
    },
    removeItem: async () => {
      throw new Error("AsyncStorage must not be used on native");
    },
    setItem: async () => {
      throw new Error("AsyncStorage must not be used on native");
    },
  },
}));

mock.module("expo-constants", () => ({
  default: {default: undefined, expoConfig: {version: "1.2.3"}},
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
  getAuthToken: async () => secureStorage.get("AUTH_TOKEN") ?? null,
}));

mock.module("../offlineGate", () => ({
  shouldDeferOfflineMutation: () => false,
}));

const {getBaseQuery, getTokenExpirationTimes, refreshAuthToken, shouldShowStillThereModal} =
  await import("../emptyApi");

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

const setTokens = ({auth, refresh}: {auth: number; refresh: number}): void => {
  secureStorage.set("AUTH_TOKEN", makeToken(auth));
  secureStorage.set("REFRESH_TOKEN", makeToken(refresh));
};

const fetchMock = mock(
  async () =>
    new Response(JSON.stringify({data: {ok: true}}), {
      headers: {"content-type": "application/json"},
      status: 200,
    })
);
globalThis.fetch = fetchMock as unknown as typeof fetch;

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
  }) as unknown as Parameters<typeof getBaseQuery>[1];

beforeEach(() => {
  secureStorage.clear();
  axiosPost.mockClear();
  fetchMock.mockClear();
  axiosDefaults.headers.common = {};
});

describe("getTokenExpirationTimes on native", () => {
  it("reads both tokens from secure storage", async () => {
    setTokens({auth: 300, refresh: 600});

    const {authRemainingSecs, refreshRemainingSecs} = await getTokenExpirationTimes();

    expect(authRemainingSecs).toBeGreaterThan(290);
    expect(refreshRemainingSecs).toBeGreaterThan(590);
  });

  it("returns undefined when secure storage is empty", async () => {
    expect(await getTokenExpirationTimes()).toEqual({
      authRemainingSecs: undefined,
      refreshRemainingSecs: undefined,
    });
  });

  it("shows the still there modal when the refresh token is nearly expired", async () => {
    setTokens({auth: 30, refresh: 30});
    expect(await shouldShowStillThereModal()).toBe(true);
  });
});

describe("refreshAuthToken on native", () => {
  it("stores the refreshed tokens in secure storage", async () => {
    setTokens({auth: 10, refresh: 600});

    await refreshAuthToken();

    expect(secureStorage.get("AUTH_TOKEN")).toBe("native-auth");
    expect(secureStorage.get("REFRESH_TOKEN")).toBe("native-refresh");
    expect(axiosDefaults.headers.common.Authorization).toBe("Bearer native-auth");
  });

  it("throws when secure storage has no refresh token", async () => {
    await expect(refreshAuthToken()).rejects.toThrow("no refresh token found");
  });
});

describe("getBaseQuery on native", () => {
  it("sends the mobile platform header and the app version", async () => {
    await getBaseQuery("/todos", createApiArg(), {}, "native-token");

    const request = fetchMock.mock.calls[0]?.[0] as unknown as Request;
    expect(request.headers.get("app-platform")).toBe("mobile");
    expect(request.headers.get("app-version")).toBe("1.2.3");
  });
});
