import {describe, it} from "bun:test";
import {configureStore} from "@reduxjs/toolkit";
import {renderHook} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {Provider} from "react-redux";

import {
  ADMIN_PAGE_PERMISSION,
  canOpenAdminPage,
  createPermissionSelectors,
  DEFAULT_PERMISSION_API_REDUCER_PATH,
  hasPermission,
  selectPermissions,
} from "./usePermissions";

describe("canOpenAdminPage", () => {
  it("requires admin:access when a permissions object is present", () => {
    assert.isTrue(canOpenAdminPage({admin: false, permissions: {admin: ["access"]}}));
    assert.isTrue(hasPermission({admin: ["access", "runScripts"]}, ADMIN_PAGE_PERMISSION));
    assert.isFalse(canOpenAdminPage({admin: true, permissions: {}}));
    assert.isFalse(
      canOpenAdminPage({
        admin: true,
        permissions: {admin: ["runScripts"], adminTodo: ["read", "write"]},
      })
    );
  });

  it("falls back to the admin flag when RBAC permissions are absent", () => {
    assert.isTrue(canOpenAdminPage({admin: true}));
    assert.isFalse(canOpenAdminPage({admin: false}));
    assert.isFalse(canOpenAdminPage({}));
  });
});

describe("hasPermission", () => {
  it("returns false when the permission set is missing", () => {
    assert.isFalse(hasPermission(undefined, {todo: ["read"]}));
  });

  it("treats a missing resource as no grants", () => {
    assert.isFalse(hasPermission({admin: ["access"]}, {todo: ["read"]}));
  });

  it("allows an empty action list for a resource", () => {
    assert.isTrue(hasPermission({todo: ["read"]}, {todo: []}));
    assert.isTrue(hasPermission({todo: ["read"]}, {todo: undefined as unknown as string[]}));
  });
});

describe("createPermissionSelectors", () => {
  const {
    selectPermissions: selectFromApi,
    useCan,
    useSelectPermissions,
  } = createPermissionSelectors({
    reducerPath: DEFAULT_PERMISSION_API_REDUCER_PATH,
  });

  const createStore = (state: Record<string, unknown>) =>
    configureStore({
      preloadedState: state,
      reducer: (current: Record<string, unknown> | undefined) => current ?? state,
    });

  const wrap = (store: ReturnType<typeof createStore>): React.FC<{children: React.ReactNode}> => {
    const Wrapper: React.FC<{children: React.ReactNode}> = ({children}) =>
      React.createElement(Provider, {children, store});
    return Wrapper;
  };

  it("returns undefined when the user is logged out", () => {
    const store = createStore({
      auth: {userId: null},
      [DEFAULT_PERMISSION_API_REDUCER_PATH]: {
        queries: {
          'getMe({"id":1})': {data: {permissions: {admin: ["access"]}}, endpointName: "getMe"},
        },
      },
    });
    assert.isUndefined(selectFromApi(store.getState() as never));
  });

  it("returns undefined when the api slice has no queries", () => {
    const store = createStore({auth: {userId: "u1"}});
    assert.isUndefined(selectFromApi(store.getState() as never));
  });

  it("skips unfulfilled and non-me queries then returns me permissions", () => {
    const store = createStore({
      auth: {userId: "u1"},
      [DEFAULT_PERMISSION_API_REDUCER_PATH]: {
        queries: {
          "getMe(undefined)": {
            data: {permissions: {admin: ["access"]}},
            endpointName: "getMe",
            status: "fulfilled",
          },
          other: {
            data: {permissions: {todo: ["read"]}},
            endpointName: "getTodos",
            status: "fulfilled",
          },
          pending: {
            data: {permissions: {admin: ["access"]}},
            endpointName: "getMe",
            status: "pending",
          },
        },
      },
    });
    assert.deepEqual(selectFromApi(store.getState() as never), {admin: ["access"]});
    assert.deepEqual(selectPermissions(store.getState() as never), {admin: ["access"]});
  });

  it("matches auth/me cache keys when endpointName is missing", () => {
    const store = createStore({
      auth: {userId: "u1"},
      [DEFAULT_PERMISSION_API_REDUCER_PATH]: {
        queries: {
          "auth/me": {data: {permissions: {todo: ["write"]}}, status: "fulfilled"},
        },
      },
    });
    assert.deepEqual(selectFromApi(store.getState() as never), {todo: ["write"]});
  });

  it("skips cache entries without permissions payloads", () => {
    const store = createStore({
      auth: {userId: "u1"},
      [DEFAULT_PERMISSION_API_REDUCER_PATH]: {
        queries: {
          "authMe(undefined)": {data: {}, endpointName: "authMe", status: "fulfilled"},
          "getMe(1)": {endpointName: "getMe", status: "fulfilled"},
        },
      },
    });
    assert.isUndefined(selectFromApi(store.getState() as never));
  });

  it("reads permissions from an authMe endpoint with an unrelated cache key", () => {
    const store = createStore({
      auth: {userId: "u1"},
      [DEFAULT_PERMISSION_API_REDUCER_PATH]: {
        queries: {
          "session-1": {
            data: {permissions: {todo: ["read"]}},
            endpointName: "authMe",
            status: "fulfilled",
          },
        },
      },
    });
    assert.deepEqual(selectFromApi(store.getState() as never), {todo: ["read"]});
  });

  it("returns undefined when no cache entry looks like a me query", () => {
    const store = createStore({
      auth: {userId: "u1"},
      [DEFAULT_PERMISSION_API_REDUCER_PATH]: {
        queries: {
          "getTodos(undefined)": {
            data: {permissions: {todo: ["read"]}},
            endpointName: "getTodos",
            status: "fulfilled",
          },
        },
      },
    });
    assert.isUndefined(selectFromApi(store.getState() as never));
  });

  it("reads permissions when the store has no auth slice", () => {
    const store = createStore({
      [DEFAULT_PERMISSION_API_REDUCER_PATH]: {
        queries: {
          "getMe(undefined)": {
            data: {permissions: {admin: ["access"]}},
            endpointName: "getMe",
            status: "fulfilled",
          },
        },
      },
    });
    assert.deepEqual(selectFromApi(store.getState() as never), {admin: ["access"]});
  });

  it("useCan returns false when the user has no permissions cached", () => {
    const store = createStore({auth: {userId: "u1"}});
    const {result} = renderHook(() => useCan(ADMIN_PAGE_PERMISSION), {wrapper: wrap(store)});
    assert.isFalse(result.current);
  });

  it("useSelectPermissions and useCan read from the store", () => {
    const store = createStore({
      auth: {userId: "u1"},
      [DEFAULT_PERMISSION_API_REDUCER_PATH]: {
        queries: {
          getProfile: {
            data: {permissions: {admin: ["access"]}},
            endpointName: "getProfile",
            status: "fulfilled",
          },
        },
      },
    });
    const {result: perms} = renderHook(() => useSelectPermissions(), {wrapper: wrap(store)});
    assert.deepEqual(perms.current, {admin: ["access"]});
    const {result: can} = renderHook(() => useCan(ADMIN_PAGE_PERMISSION), {wrapper: wrap(store)});
    assert.isTrue(can.current);
  });
});
