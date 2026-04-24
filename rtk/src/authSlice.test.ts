import {beforeEach, describe, expect, it} from "bun:test";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {configureStore} from "@reduxjs/toolkit";
import {createApi, fetchBaseQuery} from "@reduxjs/toolkit/query/react";

import {
  type EmailLoginRequest,
  generateAuthSlice,
  generateProfileEndpoints,
  getAuthToken,
  selectCurrentUserId,
  selectIsAuthenticating,
  selectLastTokenRefreshTimestamp,
  useSelectCurrentUserId,
  useSelectIsAuthenticating,
} from "./authSlice";

// Create a real RTK Query API with the endpoints that generateAuthSlice expects
const api = createApi({
  baseQuery: fetchBaseQuery({baseUrl: "/"}),
  endpoints: (builder) => ({
    emailLogin: builder.mutation({
      query: (body: EmailLoginRequest) => ({body, method: "POST", url: "auth/login"}),
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

const createTestStore = () => {
  const {authReducer, middleware, ...rest} = generateAuthSlice(
    // biome-ignore lint/suspicious/noExplicitAny: Test mock
    api as any
  );

  return {
    ...rest,
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

describe("generateAuthSlice", () => {
  let store: ReturnType<typeof createTestStore>["store"];
  let authSlice: ReturnType<typeof createTestStore>["authSlice"];

  beforeEach(() => {
    const result = createTestStore();
    store = result.store;
    authSlice = result.authSlice;
  });

  describe("initial state", () => {
    it("has correct initial values", () => {
      const state = store.getState().auth;
      expect(state.userId).toBeNull();
      expect(state.error).toBeNull();
      expect(state.isAuthenticating).toBe(false);
      expect(state.lastTokenRefreshTimestamp).toBeNull();
    });
  });

  describe("reducers", () => {
    it("setUserId sets userId and clears isAuthenticating", () => {
      store.dispatch(authSlice.actions.setUserId({userId: "user-123"}));
      const state = store.getState().auth;
      expect(state.userId).toBe("user-123");
      expect(state.isAuthenticating).toBe(false);
    });

    it("logout clears state", () => {
      store.dispatch(authSlice.actions.setUserId({userId: "user-123"}));
      store.dispatch(authSlice.actions.logout());
      const state = store.getState().auth;
      expect(state.userId).toBeNull();
      expect(state.isAuthenticating).toBe(false);
      expect(state.lastTokenRefreshTimestamp).toBeNull();
    });

    it("tokenRefreshedSuccess sets timestamp", () => {
      const before = Date.now();
      store.dispatch(authSlice.actions.tokenRefreshedSuccess());
      const state = store.getState().auth;
      expect(state.lastTokenRefreshTimestamp).toBeGreaterThanOrEqual(before);
      expect(state.lastTokenRefreshTimestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("emailLogin matchers", () => {
    it("matchPending sets isAuthenticating and clears error", () => {
      // Simulate a pending email login action
      store.dispatch({
        meta: {arg: {endpointName: "emailLogin", type: "mutation"}, requestId: "test-1"},
        payload: undefined,
        type: "terreno-rtk/executeMutation/pending",
      });
      const state = store.getState().auth;
      expect(state.isAuthenticating).toBe(true);
      expect(state.error).toBeNull();
    });

    it("matchFulfilled clears isAuthenticating", () => {
      // Set authenticating first
      store.dispatch({
        meta: {arg: {endpointName: "emailLogin", type: "mutation"}, requestId: "test-1"},
        payload: undefined,
        type: "terreno-rtk/executeMutation/pending",
      });
      expect(store.getState().auth.isAuthenticating).toBe(true);

      // Then fulfill
      store.dispatch({
        meta: {arg: {endpointName: "emailLogin", type: "mutation"}, requestId: "test-1"},
        payload: {token: "abc", userId: "user-1"},
        type: "terreno-rtk/executeMutation/fulfilled",
      });
      expect(store.getState().auth.isAuthenticating).toBe(false);
    });

    it("matchRejected sets error and clears isAuthenticating", () => {
      // Set authenticating first
      store.dispatch({
        meta: {arg: {endpointName: "emailLogin", type: "mutation"}, requestId: "test-1"},
        payload: undefined,
        type: "terreno-rtk/executeMutation/pending",
      });

      // Then reject with error
      store.dispatch({
        meta: {arg: {endpointName: "emailLogin", type: "mutation"}, requestId: "test-1"},
        payload: {data: {message: "Invalid credentials"}},
        type: "terreno-rtk/executeMutation/rejected",
      });
      const state = store.getState().auth;
      expect(state.isAuthenticating).toBe(false);
      expect(state.error).toBe("Invalid credentials");
    });
  });

  describe("emailSignUp matchers", () => {
    it("matchPending sets isAuthenticating and clears error", () => {
      store.dispatch({
        meta: {arg: {endpointName: "emailSignUp", type: "mutation"}, requestId: "test-1"},
        payload: undefined,
        type: "terreno-rtk/executeMutation/pending",
      });
      const state = store.getState().auth;
      expect(state.isAuthenticating).toBe(true);
      expect(state.error).toBeNull();
    });

    it("matchFulfilled clears isAuthenticating", () => {
      store.dispatch({
        meta: {arg: {endpointName: "emailSignUp", type: "mutation"}, requestId: "test-1"},
        payload: undefined,
        type: "terreno-rtk/executeMutation/pending",
      });
      store.dispatch({
        meta: {arg: {endpointName: "emailSignUp", type: "mutation"}, requestId: "test-1"},
        payload: {token: "abc", userId: "user-1"},
        type: "terreno-rtk/executeMutation/fulfilled",
      });
      expect(store.getState().auth.isAuthenticating).toBe(false);
    });

    it("matchRejected sets error and clears isAuthenticating", () => {
      store.dispatch({
        meta: {arg: {endpointName: "emailSignUp", type: "mutation"}, requestId: "test-1"},
        payload: undefined,
        type: "terreno-rtk/executeMutation/pending",
      });
      store.dispatch({
        meta: {arg: {endpointName: "emailSignUp", type: "mutation"}, requestId: "test-1"},
        payload: {data: {message: "Email already exists"}},
        type: "terreno-rtk/executeMutation/rejected",
      });
      const state = store.getState().auth;
      expect(state.isAuthenticating).toBe(false);
      expect(state.error).toBe("Email already exists");
    });
  });

  describe("googleLogin matchers", () => {
    it("matchPending sets isAuthenticating and clears error", () => {
      store.dispatch({
        meta: {arg: {endpointName: "googleLogin", type: "mutation"}, requestId: "test-1"},
        payload: undefined,
        type: "terreno-rtk/executeMutation/pending",
      });
      const state = store.getState().auth;
      expect(state.isAuthenticating).toBe(true);
      expect(state.error).toBeNull();
    });

    it("matchPending clears stale error from previous attempt", () => {
      // First: fail a login to set an error
      store.dispatch({
        meta: {arg: {endpointName: "emailLogin", type: "mutation"}, requestId: "test-1"},
        payload: {data: {message: "Previous error"}},
        type: "terreno-rtk/executeMutation/rejected",
      });
      expect(store.getState().auth.error).toBe("Previous error");

      // Then: start a google login — should clear the error
      store.dispatch({
        meta: {arg: {endpointName: "googleLogin", type: "mutation"}, requestId: "test-2"},
        payload: undefined,
        type: "terreno-rtk/executeMutation/pending",
      });
      expect(store.getState().auth.error).toBeNull();
    });

    it("matchFulfilled clears isAuthenticating", () => {
      store.dispatch({
        meta: {arg: {endpointName: "googleLogin", type: "mutation"}, requestId: "test-1"},
        payload: undefined,
        type: "terreno-rtk/executeMutation/pending",
      });
      store.dispatch({
        meta: {arg: {endpointName: "googleLogin", type: "mutation"}, requestId: "test-1"},
        payload: {token: "abc", userId: "user-1"},
        type: "terreno-rtk/executeMutation/fulfilled",
      });
      expect(store.getState().auth.isAuthenticating).toBe(false);
    });

    it("matchRejected sets error and clears isAuthenticating", () => {
      store.dispatch({
        meta: {arg: {endpointName: "googleLogin", type: "mutation"}, requestId: "test-1"},
        payload: undefined,
        type: "terreno-rtk/executeMutation/pending",
      });
      store.dispatch({
        meta: {arg: {endpointName: "googleLogin", type: "mutation"}, requestId: "test-1"},
        payload: {data: {message: "Google auth failed"}},
        type: "terreno-rtk/executeMutation/rejected",
      });
      const state = store.getState().auth;
      expect(state.isAuthenticating).toBe(false);
      expect(state.error).toBe("Google auth failed");
    });
  });

  describe("persist/REHYDRATE", () => {
    it("resets isAuthenticating to false", () => {
      // Set authenticating
      store.dispatch({
        meta: {arg: {endpointName: "emailLogin", type: "mutation"}, requestId: "test-1"},
        payload: undefined,
        type: "terreno-rtk/executeMutation/pending",
      });
      expect(store.getState().auth.isAuthenticating).toBe(true);

      // Simulate rehydration
      store.dispatch({type: "persist/REHYDRATE"});
      expect(store.getState().auth.isAuthenticating).toBe(false);
    });
  });
});

describe("selectors", () => {
  it("selectCurrentUserId returns userId", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Test mock state
    const state = {auth: {userId: "user-123"}} as any;
    expect(selectCurrentUserId(state)).toBe("user-123");
  });

  it("selectCurrentUserId returns undefined when no auth state", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Test mock state
    expect(selectCurrentUserId({} as any)).toBeUndefined();
  });

  it("selectIsAuthenticating returns isAuthenticating", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Test mock state
    const state = {auth: {isAuthenticating: true}} as any;
    expect(selectIsAuthenticating(state)).toBe(true);
  });

  it("selectIsAuthenticating defaults to false", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Test mock state
    expect(selectIsAuthenticating({} as any)).toBe(false);
  });

  it("selectLastTokenRefreshTimestamp returns timestamp", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Test mock state
    const state = {auth: {lastTokenRefreshTimestamp: 12345}} as any;
    expect(selectLastTokenRefreshTimestamp(state)).toBe(12345);
  });
});

describe("EmailLoginRequest type", () => {
  it("accepts email-based login", () => {
    const request: EmailLoginRequest = {email: "test@example.com", password: "pass"};
    expect(request.email).toBe("test@example.com");
    expect(request.password).toBe("pass");
  });

  it("accepts username-based login", () => {
    const request: EmailLoginRequest = {password: "pass", username: "testuser"};
    expect(request.username).toBe("testuser");
    expect(request.password).toBe("pass");
  });
});

describe("generateProfileEndpoints", () => {
  it("builds endpoint query payloads", () => {
    const builder = {
      // biome-ignore lint/suspicious/noExplicitAny: Testing generated endpoint configs
      mutation: (config: any) => config,
    };
    // biome-ignore lint/suspicious/noExplicitAny: Lightweight fake builder for unit test
    const endpoints = generateProfileEndpoints(builder as any, "todos");
    const createEmailUserQuery = endpoints.createEmailUser.query;
    const emailLoginQuery = endpoints.emailLogin.query;
    const emailSignUpQuery = endpoints.emailSignUp.query;
    const googleLoginQuery = endpoints.googleLogin.query;
    const resetPasswordQuery = endpoints.resetPassword.query;

    expect(createEmailUserQuery).toBeDefined();
    expect(emailLoginQuery).toBeDefined();
    expect(emailSignUpQuery).toBeDefined();
    expect(googleLoginQuery).toBeDefined();
    expect(resetPasswordQuery).toBeDefined();

    if (
      !createEmailUserQuery ||
      !emailLoginQuery ||
      !emailSignUpQuery ||
      !googleLoginQuery ||
      !resetPasswordQuery
    ) {
      throw new Error("Expected all generated profile endpoint queries to be defined");
    }

    expect(endpoints.createEmailUser.invalidatesTags).toEqual(["todos", "conversations"]);
    expect(
      createEmailUserQuery({
        email: "new@example.com",
        password: "secret",
        role: "admin",
      })
    ).toEqual({
      body: {email: "new@example.com", password: "secret", role: "admin"},
      method: "POST",
      url: "auth/signup",
    });

    expect(endpoints.emailLogin.extraOptions).toEqual({maxRetries: 0});
    expect(emailLoginQuery({email: "a@example.com", password: "pw"})).toEqual({
      body: {email: "a@example.com", password: "pw", username: undefined},
      method: "POST",
      url: "auth/login",
    });

    expect(
      emailSignUpQuery({
        email: "signup@example.com",
        name: "New User",
        password: "pw",
      })
    ).toEqual({
      body: {email: "signup@example.com", name: "New User", password: "pw"},
      method: "POST",
      url: "auth/signup",
    });

    expect(googleLoginQuery({idToken: "id-token"})).toEqual({
      body: {idToken: "id-token"},
      method: "POST",
      url: "/auth/google",
    });

    expect(
      resetPasswordQuery({
        _id: "u-1",
        email: "user@example.com",
        newPassword: "new-secret",
        oldPassword: "old-secret",
        password: "current-secret",
      })
    ).toEqual({
      body: {
        _id: "u-1",
        email: "user@example.com",
        newPassword: "new-secret",
        oldPassword: "old-secret",
        password: "current-secret",
      },
      method: "POST",
      url: "/resetPassword",
    });
  });
});

describe("listener middleware side effects", () => {
  it("stores tokens in AsyncStorage on web login when window exists", async () => {
    const {store} = createTestStore();
    const setItemCalls: Array<[string, string]> = [];
    const originalSetItem = AsyncStorage.setItem;
    const globalWithWindow = globalThis as {window?: unknown};
    const originalWindow = globalWithWindow.window;

    AsyncStorage.setItem = async (key: string, value: string): Promise<void> => {
      setItemCalls.push([key, value]);
    };
    globalWithWindow.window = {};

    try {
      store.dispatch({
        meta: {arg: {endpointName: "emailLogin", type: "mutation"}, requestId: "listener-login-1"},
        payload: {refreshToken: "refresh-token", token: "auth-token", userId: "user-123"},
        type: "terreno-rtk/executeMutation/fulfilled",
      });

      await flushAsyncListeners();

      expect(setItemCalls).toEqual([
        ["AUTH_TOKEN", "auth-token"],
        ["REFRESH_TOKEN", "refresh-token"],
      ]);
      expect(store.getState().auth.userId).toBe("user-123");
    } finally {
      AsyncStorage.setItem = originalSetItem;
      if (typeof originalWindow === "undefined") {
        delete globalWithWindow.window;
      } else {
        globalWithWindow.window = originalWindow;
      }
    }
  });

  it("re-throws and logs when AsyncStorage.setItem fails on web login", async () => {
    const {store} = createTestStore();
    const originalSetItem = AsyncStorage.setItem;
    const originalConsoleError = console.error;
    const globalWithWindow = globalThis as {window?: unknown};
    const originalWindow = globalWithWindow.window;
    const errorCalls: unknown[][] = [];

    console.error = (...args: unknown[]): void => {
      errorCalls.push(args);
    };
    AsyncStorage.setItem = async (): Promise<void> => {
      throw new Error("storage quota exceeded");
    };
    globalWithWindow.window = {};

    try {
      store.dispatch({
        meta: {
          arg: {endpointName: "emailLogin", type: "mutation"},
          requestId: "listener-login-error",
        },
        payload: {refreshToken: "refresh-token", token: "auth-token", userId: "user-err"},
        type: "terreno-rtk/executeMutation/fulfilled",
      });

      await flushAsyncListeners();

      const loggedErrorMessage = errorCalls.find((args) =>
        args.some(
          (value) => typeof value === "string" && value.includes("Error setting auth token")
        )
      );
      expect(loggedErrorMessage).toBeDefined();
    } finally {
      AsyncStorage.setItem = originalSetItem;
      console.error = originalConsoleError;
      if (typeof originalWindow === "undefined") {
        delete globalWithWindow.window;
      } else {
        globalWithWindow.window = originalWindow;
      }
    }
  });

  it("skips storing auth tokens when window is undefined (SSR context)", async () => {
    const {store} = createTestStore();
    const setItemCalls: Array<[string, string]> = [];
    const originalSetItem = AsyncStorage.setItem;
    const globalWithWindow = globalThis as {window?: unknown};
    const originalWindow = globalWithWindow.window;

    AsyncStorage.setItem = async (key: string, value: string): Promise<void> => {
      setItemCalls.push([key, value]);
    };
    delete globalWithWindow.window;

    try {
      store.dispatch({
        meta: {
          arg: {endpointName: "emailSignUp", type: "mutation"},
          requestId: "listener-ssr-1",
        },
        payload: {refreshToken: "r", token: "t", userId: "user-ssr"},
        type: "terreno-rtk/executeMutation/fulfilled",
      });

      await flushAsyncListeners();

      expect(setItemCalls).toEqual([]);
      expect(store.getState().auth.userId).toBe("user-ssr");
    } finally {
      AsyncStorage.setItem = originalSetItem;
      if (typeof originalWindow !== "undefined") {
        globalWithWindow.window = originalWindow;
      }
    }
  });

  it("removes tokens from AsyncStorage on web logout when window exists", async () => {
    const {store, authSlice} = createTestStore();
    const removeItemCalls: string[] = [];
    const originalRemoveItem = AsyncStorage.removeItem;
    const globalWithWindow = globalThis as {window?: unknown};
    const originalWindow = globalWithWindow.window;

    AsyncStorage.removeItem = async (key: string): Promise<void> => {
      removeItemCalls.push(key);
    };
    globalWithWindow.window = {};

    try {
      store.dispatch(authSlice.actions.logout());
      await flushAsyncListeners();

      expect(removeItemCalls).toEqual(["AUTH_TOKEN", "REFRESH_TOKEN"]);
    } finally {
      AsyncStorage.removeItem = originalRemoveItem;
      if (typeof originalWindow === "undefined") {
        delete globalWithWindow.window;
      } else {
        globalWithWindow.window = originalWindow;
      }
    }
  });
});

describe("hook wrappers", () => {
  it("throws when hook selectors are called outside React render", () => {
    expect(() => useSelectCurrentUserId()).toThrow();
    expect(() => useSelectIsAuthenticating()).toThrow();
  });
});

describe("getAuthToken", () => {
  it("reads AUTH_TOKEN from AsyncStorage when window exists", async () => {
    const originalGetItem = AsyncStorage.getItem;
    const globalWithWindow = globalThis as {window?: unknown};
    const originalWindow = globalWithWindow.window;

    AsyncStorage.getItem = async (key: string): Promise<string | null> => {
      return key === "AUTH_TOKEN" ? "stored-auth-token" : null;
    };
    globalWithWindow.window = {};

    try {
      const token = await getAuthToken();
      expect(token).toBe("stored-auth-token");
    } finally {
      AsyncStorage.getItem = originalGetItem;
      if (typeof originalWindow === "undefined") {
        delete globalWithWindow.window;
      } else {
        globalWithWindow.window = originalWindow;
      }
    }
  });

  it("returns null when window is unavailable in SSR context", async () => {
    const globalWithWindow = globalThis as {window?: unknown};
    const originalWindow = globalWithWindow.window;

    delete globalWithWindow.window;
    try {
      const token = await getAuthToken();
      expect(token).toBeNull();
    } finally {
      if (typeof originalWindow !== "undefined") {
        globalWithWindow.window = originalWindow;
      }
    }
  });
});
