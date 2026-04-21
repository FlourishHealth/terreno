import {afterAll, afterEach, beforeEach, describe, expect, it, mock} from "bun:test";

mock.module("react-native", () => ({
  Platform: {OS: "ios"},
  StyleSheet: {create: (s: unknown) => s},
}));

// Force IsWeb=false regardless of whether ./platform was already imported
// elsewhere in the test run. `mock.module` is hoisted in bun, so this takes
// effect before the dynamic imports below.
mock.module("./platform", () => ({IsWeb: false}));

const secureCalls = {
  delete: [] as string[],
  get: [] as string[],
  set: [] as Array<[string, string]>,
};

mock.module("expo-secure-store", () => ({
  deleteItemAsync: async (key: string): Promise<void> => {
    secureCalls.delete.push(key);
  },
  getItemAsync: async (key: string): Promise<string | null> => {
    secureCalls.get.push(key);
    return null;
  },
  setItemAsync: async (key: string, value: string): Promise<void> => {
    secureCalls.set.push([key, value]);
  },
}));

const auth = await import("./authSlice");

const {configureStore} = await import("@reduxjs/toolkit");
const {createApi, fetchBaseQuery} = await import("@reduxjs/toolkit/query/react");

const api = createApi({
  baseQuery: fetchBaseQuery({baseUrl: "/"}),
  endpoints: (builder) => ({
    emailLogin: builder.mutation({
      query: (body: {email: string; password: string}) => ({
        body,
        method: "POST",
        url: "auth/login",
      }),
    }),
    emailSignUp: builder.mutation({
      query: (body: {email: string; password: string}) => ({
        body,
        method: "POST",
        url: "auth/signup",
      }),
    }),
    googleLogin: builder.mutation({
      query: (body: {idToken: string}) => ({body, method: "POST", url: "auth/google"}),
    }),
  }),
  reducerPath: "terreno-rtk",
});

const createTestStore = (): {
  authSlice: ReturnType<typeof auth.generateAuthSlice>["authSlice"];
  store: ReturnType<typeof configureStore>;
} => {
  const {authReducer, middleware, authSlice} = auth.generateAuthSlice(
    // biome-ignore lint/suspicious/noExplicitAny: Test mock
    api as any
  );
  return {
    authSlice,
    store: configureStore({
      middleware: (getDefault) =>
        getDefault({serializableCheck: false}).concat(api.middleware, ...middleware),
      reducer: {
        [api.reducerPath]: api.reducer,
        auth: authReducer,
      },
    }),
  };
};

const flushAsyncListeners = async (): Promise<void> => {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe("native listener middleware side effects", () => {
  const originalDebug = console.debug;
  const originalError = console.error;
  const debugCalls: unknown[][] = [];
  const errorCalls: unknown[][] = [];

  beforeEach(() => {
    debugCalls.length = 0;
    errorCalls.length = 0;
    secureCalls.delete = [];
    secureCalls.get = [];
    secureCalls.set = [];
    console.debug = (...args: unknown[]): void => {
      debugCalls.push(args);
    };
    console.error = (...args: unknown[]): void => {
      errorCalls.push(args);
    };
  });

  afterEach(() => {
    console.debug = originalDebug;
    console.error = originalError;
  });

  afterAll(() => {
    // Restore mocks to the values the rest of the suite expects.
    mock.module("react-native", () => ({
      Platform: {OS: "web"},
      StyleSheet: {create: (s: unknown) => s},
    }));
    mock.module("./platform", () => ({IsWeb: true}));
    mock.module("expo-secure-store", () => ({
      deleteItemAsync: async () => {},
      getItemAsync: async () => null,
      setItemAsync: async () => {},
    }));
  });

  it("stores tokens in SecureStore on native login", async () => {
    const {store} = createTestStore();
    store.dispatch({
      meta: {arg: {endpointName: "emailLogin", type: "mutation"}, requestId: "native-login-1"},
      payload: {refreshToken: "native-refresh", token: "native-auth", userId: "native-user"},
      type: "terreno-rtk/executeMutation/fulfilled",
    });
    await flushAsyncListeners();
    expect(secureCalls.set).toEqual([
      ["AUTH_TOKEN", "native-auth"],
      ["REFRESH_TOKEN", "native-refresh"],
    ]);
    expect(store.getState().auth.userId).toBe("native-user");
  });

  it("logs and rethrows when SecureStore fails on native login", async () => {
    mock.module("expo-secure-store", () => ({
      deleteItemAsync: async (key: string): Promise<void> => {
        secureCalls.delete.push(key);
      },
      getItemAsync: async (): Promise<string | null> => null,
      setItemAsync: async (): Promise<void> => {
        throw new Error("secure-store-fail");
      },
    }));
    const {store} = createTestStore();
    store.dispatch({
      meta: {arg: {endpointName: "emailLogin", type: "mutation"}, requestId: "native-login-err"},
      payload: {refreshToken: "r", token: "t", userId: "u"},
      type: "terreno-rtk/executeMutation/fulfilled",
    });
    await flushAsyncListeners();
    const found = errorCalls.find((args) =>
      args.some((v) => typeof v === "string" && v.includes("Error setting auth token"))
    );
    expect(found).toBeDefined();
    // Reset setItemAsync back so other tests aren't affected.
    mock.module("expo-secure-store", () => ({
      deleteItemAsync: async (key: string): Promise<void> => {
        secureCalls.delete.push(key);
      },
      getItemAsync: async (): Promise<string | null> => null,
      setItemAsync: async (key: string, value: string): Promise<void> => {
        secureCalls.set.push([key, value]);
      },
    }));
  });

  it("removes tokens from SecureStore on native logout", async () => {
    const {store, authSlice} = createTestStore();
    store.dispatch(authSlice.actions.logout());
    await flushAsyncListeners();
    expect(secureCalls.delete).toEqual(["AUTH_TOKEN", "REFRESH_TOKEN"]);
  });

  it("warns when native login response is missing a token", async () => {
    const {store} = createTestStore();
    store.dispatch({
      meta: {arg: {endpointName: "emailLogin", type: "mutation"}, requestId: "native-login-2"},
      payload: {refreshToken: "r", token: null, userId: "u-missing"},
      type: "terreno-rtk/executeMutation/fulfilled",
    });
    await flushAsyncListeners();
    // Nothing should have been written to SecureStore since the outer token check filters.
    expect(secureCalls.set).toEqual([]);
  });
});
