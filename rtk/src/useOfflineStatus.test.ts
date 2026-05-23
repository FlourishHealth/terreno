import {beforeEach, describe, expect, it} from "bun:test";
import {configureStore} from "@reduxjs/toolkit";
import {act, renderHook} from "@testing-library/react-native";
import React from "react";
import {Provider} from "react-redux";

import {
  addConflict,
  type ConflictRecord,
  enqueue,
  offlineReducer,
  type QueuedMutation,
  setOnlineStatus,
  setSyncing,
} from "./offlineSlice";
import {useOfflineStatus} from "./useOfflineStatus";

const createTestStore = () =>
  configureStore({
    reducer: {offline: offlineReducer},
  });

const createWrapper = (store: ReturnType<typeof createTestStore>) => {
  const Wrapper: React.FC<{children: React.ReactNode}> = ({children}) =>
    React.createElement(Provider, {children, store});
  return Wrapper;
};

describe("useOfflineStatus", () => {
  let store: ReturnType<typeof createTestStore>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("returns initial online state", () => {
    const {result} = renderHook(() => useOfflineStatus(), {
      wrapper: createWrapper(store),
    });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.queueLength).toBe(0);
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.conflicts).toEqual([]);
    expect(result.current.undismissedConflicts).toEqual([]);
  });

  it("reflects offline state", () => {
    store.dispatch(setOnlineStatus(false));

    const {result} = renderHook(() => useOfflineStatus(), {
      wrapper: createWrapper(store),
    });

    expect(result.current.isOnline).toBe(false);
  });

  it("reports queue length", () => {
    const mutation: QueuedMutation = {
      args: {body: {title: "Test"}},
      endpointName: "postTodos",
      id: "test-1",
      timestamp: "2026-01-01T00:00:00.000Z",
      type: "create",
    };
    store.dispatch(enqueue(mutation));

    const {result} = renderHook(() => useOfflineStatus(), {
      wrapper: createWrapper(store),
    });

    expect(result.current.queueLength).toBe(1);
  });

  it("reports syncing state", () => {
    store.dispatch(setSyncing(true));

    const {result} = renderHook(() => useOfflineStatus(), {
      wrapper: createWrapper(store),
    });

    expect(result.current.isSyncing).toBe(true);
  });

  it("filters undismissed conflicts", () => {
    const conflict: ConflictRecord = {
      args: {id: "abc"},
      dismissed: false,
      endpointName: "patchTodosById",
      id: "conflict-1",
      serverDocument: {title: "Server"},
      timestamp: "2026-01-01T00:00:00.000Z",
    };
    store.dispatch(addConflict(conflict));

    const {result} = renderHook(() => useOfflineStatus(), {
      wrapper: createWrapper(store),
    });

    expect(result.current.conflicts).toHaveLength(1);
    expect(result.current.undismissedConflicts).toHaveLength(1);
  });

  it("dismissConflict dispatches the action", () => {
    const conflict: ConflictRecord = {
      args: {id: "abc"},
      dismissed: false,
      endpointName: "patchTodosById",
      id: "conflict-to-dismiss",
      serverDocument: {title: "Server"},
      timestamp: "2026-01-01T00:00:00.000Z",
    };
    store.dispatch(addConflict(conflict));

    const {result} = renderHook(() => useOfflineStatus(), {
      wrapper: createWrapper(store),
    });

    act(() => {
      result.current.dismissConflict("conflict-to-dismiss");
    });

    expect(result.current.undismissedConflicts).toHaveLength(0);
    expect(result.current.conflicts[0].dismissed).toBe(true);
  });

  it("clearConflicts removes all conflicts", () => {
    const conflict: ConflictRecord = {
      args: {id: "abc"},
      dismissed: false,
      endpointName: "patchTodosById",
      id: "conflict-clear",
      serverDocument: {title: "Server"},
      timestamp: "2026-01-01T00:00:00.000Z",
    };
    store.dispatch(addConflict(conflict));

    const {result} = renderHook(() => useOfflineStatus(), {
      wrapper: createWrapper(store),
    });

    act(() => {
      result.current.clearConflicts();
    });

    expect(result.current.conflicts).toHaveLength(0);
  });

  it("isLocalOnly returns true for temp-prefixed IDs", () => {
    const {result} = renderHook(() => useOfflineStatus(), {
      wrapper: createWrapper(store),
    });

    expect(result.current.isLocalOnly("temp-abc123")).toBe(true);
    expect(result.current.isLocalOnly("507f1f77bcf86cd799439011")).toBe(false);
  });
});
