import {describe, it} from "bun:test";
import {configureStore} from "@reduxjs/toolkit";
import {renderHook} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {Provider} from "react-redux";

import type {RootState} from "./constants";
import {
  ADMIN_PAGE_PERMISSION,
  canOpenAdminPage,
  createPermissionSelectors,
  DEFAULT_PERMISSION_API_REDUCER_PATH,
  hasPermission,
  type PermissionRequest,
  type PermissionSet,
  selectPermissions,
  useCan,
  useSelectPermissions,
} from "./usePermissions";

const REDUCER_PATH = "testApi";

const {selectPermissions: selectTestPermissions} = createPermissionSelectors({
  reducerPath: REDUCER_PATH,
});

const stateOf = (state: Record<string, unknown>): RootState => state as unknown as RootState;

const createStore = (preloadedState: Record<string, unknown>) =>
  configureStore({
    preloadedState,
    reducer: (state: Record<string, unknown> | undefined) => state ?? {},
  });

const createWrapper = (store: ReturnType<typeof createStore>) => {
  const Wrapper: React.FC<{children: React.ReactNode}> = ({children}) =>
    React.createElement(Provider, {children, store});
  return Wrapper;
};

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
  it("denies everything when permissions are missing", () => {
    assert.isFalse(hasPermission(undefined, ADMIN_PAGE_PERMISSION));
  });

  it("allows requests with no required actions", () => {
    assert.isTrue(hasPermission({}, {}));
    assert.isTrue(hasPermission({}, {admin: []}));
    assert.isTrue(hasPermission({}, {admin: undefined} as unknown as PermissionRequest));
  });

  it("requires every action of every requested resource", () => {
    const permissions: PermissionSet = {admin: ["access"], todo: ["read", "update"]};
    assert.isTrue(hasPermission(permissions, {admin: ["access"], todo: ["read"]}));
    assert.isFalse(hasPermission(permissions, {todo: ["read", "delete"]}));
    assert.isFalse(hasPermission(permissions, {unknownResource: ["read"]}));
  });
});

describe("createPermissionSelectors", () => {
  const permissions: PermissionSet = {admin: ["access"], todo: ["read"]};

  it("returns undefined when no user is signed in", () => {
    const state = stateOf({
      auth: {userId: null},
      [REDUCER_PATH]: {
        queries: {"getMe(undefined)": {data: {permissions}, status: "fulfilled"}},
      },
    });
    assert.isUndefined(selectTestPermissions(state));
  });

  it("returns undefined when the api slice has no queries", () => {
    assert.isUndefined(selectTestPermissions(stateOf({})));
    assert.isUndefined(selectTestPermissions(stateOf({[REDUCER_PATH]: {}})));
  });

  it("skips queries that are not fulfilled", () => {
    const state = stateOf({
      [REDUCER_PATH]: {queries: {"getMe(undefined)": {data: {permissions}, status: "pending"}}},
    });
    assert.isUndefined(selectTestPermissions(state));
  });

  it("skips queries without permissions data and queries that are not profile queries", () => {
    const state = stateOf({
      [REDUCER_PATH]: {
        queries: {
          "getMe(undefined)": {data: {}, endpointName: "getMe"},
          "getTodos(undefined)": {data: {permissions}, endpointName: "getTodos"},
        },
      },
    });
    assert.isUndefined(selectTestPermissions(state));
  });

  it("matches on the endpoint name", () => {
    const state = stateOf({
      auth: {userId: "user-1"},
      [REDUCER_PATH]: {
        queries: {
          someOpaqueCacheKey: {
            data: {permissions},
            endpointName: "authMe",
            status: "fulfilled",
          },
        },
      },
    });
    assert.deepEqual(selectTestPermissions(state), permissions);
  });

  it("matches on the cache key when the endpoint name does not match", () => {
    const state = stateOf({
      [REDUCER_PATH]: {
        queries: {"auth/me(undefined)": {data: {permissions}, endpointName: "customEndpoint"}},
      },
    });
    assert.deepEqual(selectTestPermissions(state), permissions);
  });

  it("exposes default selectors bound to the default reducer path", () => {
    const state = stateOf({
      [DEFAULT_PERMISSION_API_REDUCER_PATH]: {
        queries: {"getProfile(undefined)": {data: {permissions}}},
      },
    });
    assert.deepEqual(selectPermissions(state), permissions);
  });

  it("reads permissions through the hooks", () => {
    const store = createStore({
      [DEFAULT_PERMISSION_API_REDUCER_PATH]: {
        queries: {"getMe(undefined)": {data: {permissions}, status: "fulfilled"}},
      },
    });
    const wrapper = createWrapper(store);

    const selected = renderHook(() => useSelectPermissions(), {wrapper});
    assert.deepEqual(selected.result.current, permissions);

    const allowed = renderHook(() => useCan({todo: ["read"]}), {wrapper});
    assert.isTrue(allowed.result.current);

    const denied = renderHook(() => useCan({todo: ["delete"]}), {wrapper});
    assert.isFalse(denied.result.current);
  });
});
