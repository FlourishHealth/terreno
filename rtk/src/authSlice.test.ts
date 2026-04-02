import {beforeEach, describe, expect, it} from "bun:test";
import {configureStore} from "@reduxjs/toolkit";
import {createApi, fetchBaseQuery} from "@reduxjs/toolkit/query/react";

import {
  type EmailLoginRequest,
  generateAuthSlice,
  selectCurrentUserId,
  selectIsAuthenticating,
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
