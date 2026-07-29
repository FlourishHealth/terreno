import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {configureStore} from "@reduxjs/toolkit";
import {act, renderHook} from "@testing-library/react-native";
import React from "react";
import {Provider} from "react-redux";

import {isWebsocketsDebugEnabled, setRealtimeDebug} from "./constants";
import {offlineReducer, setOnlineStatus} from "./offlineSlice";
import {useRealtimeDebug} from "./useRealtimeDebug";

const createTestStore = (): ReturnType<typeof configureStore> =>
  configureStore({
    reducer: {offline: offlineReducer},
  });

const createWrapper = (
  store: ReturnType<typeof createTestStore>
): React.FC<{children: React.ReactNode}> => {
  const Wrapper: React.FC<{children: React.ReactNode}> = ({children}) =>
    React.createElement(Provider, {children, store});
  return Wrapper;
};

const flush = async (ms = 50): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

describe("useRealtimeDebug", () => {
  let store: ReturnType<typeof createTestStore>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    store = createTestStore();
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    // Reset the module-level runtime debug flag so tests do not leak into each other.
    setRealtimeDebug(false);
  });

  it("does not fetch when offline and returns the env-based debug value", async () => {
    store.dispatch(setOnlineStatus(false));
    const fetchFn = mock(async () => new Response("{}", {status: 200}));
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {result, unmount} = renderHook(() => useRealtimeDebug("http://localhost:4000"), {
      wrapper: createWrapper(store),
    });

    await flush();

    expect(fetchFn).not.toHaveBeenCalled();
    expect(result.current).toBe(false);
    unmount();
  });

  it("enables debug when the health endpoint reports debug true", async () => {
    const fetchFn = mock(async () => new Response(JSON.stringify({debug: true}), {status: 200}));
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {result, unmount} = renderHook(() => useRealtimeDebug("http://localhost:4000"), {
      wrapper: createWrapper(store),
    });

    await flush();

    expect(fetchFn).toHaveBeenCalled();
    const callUrl = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    expect(callUrl).toBe("http://localhost:4000/realtime/health");
    expect(isWebsocketsDebugEnabled()).toBe(true);
    expect(result.current).toBe(true);
    unmount();
  });

  it("keeps debug disabled when the health endpoint reports debug false", async () => {
    const fetchFn = mock(async () => new Response(JSON.stringify({debug: false}), {status: 200}));
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {result, unmount} = renderHook(() => useRealtimeDebug("http://localhost:4000"), {
      wrapper: createWrapper(store),
    });

    await flush();

    expect(fetchFn).toHaveBeenCalled();
    expect(isWebsocketsDebugEnabled()).toBe(false);
    expect(result.current).toBe(false);
    unmount();
  });

  it("ignores a non-ok health response", async () => {
    const fetchFn = mock(async () => new Response("error", {status: 500}));
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {result, unmount} = renderHook(() => useRealtimeDebug("http://localhost:4000"), {
      wrapper: createWrapper(store),
    });

    await flush();

    expect(fetchFn).toHaveBeenCalled();
    expect(result.current).toBe(false);
    unmount();
  });

  it("swallows fetch errors and keeps env-based debug", async () => {
    const fetchFn = mock(async () => {
      throw new Error("Network error");
    });
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {result, unmount} = renderHook(() => useRealtimeDebug("http://localhost:4000"), {
      wrapper: createWrapper(store),
    });

    await flush();

    expect(fetchFn).toHaveBeenCalled();
    expect(result.current).toBe(false);
    unmount();
  });

  it("does not apply the debug flag when the hook unmounts before the response resolves", async () => {
    let resolveJson: (value: {debug: boolean}) => void = () => {};
    const jsonPromise = new Promise<{debug: boolean}>((resolve) => {
      resolveJson = resolve;
    });
    const fetchFn = mock(async () => ({json: () => jsonPromise, ok: true}));
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {unmount} = renderHook(() => useRealtimeDebug("http://localhost:4000"), {
      wrapper: createWrapper(store),
    });

    // Unmount while the response body is still pending, then resolve it.
    unmount();
    await act(async () => {
      resolveJson({debug: true});
      await jsonPromise;
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // The cancelled guard should prevent setRealtimeDebug from running.
    expect(isWebsocketsDebugEnabled()).toBe(false);
  });

  it("re-runs the health check when the refresh key changes", async () => {
    const fetchFn = mock(async () => new Response(JSON.stringify({debug: false}), {status: 200}));
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {rerender, unmount} = renderHook(
      ({key}: {key: number}) => useRealtimeDebug("http://localhost:4000", key),
      {
        initialProps: {key: 1},
        wrapper: createWrapper(store),
      }
    );

    await flush();
    const firstCallCount = fetchFn.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);

    rerender({key: 2});
    await flush();

    expect(fetchFn.mock.calls.length).toBeGreaterThan(firstCallCount);
    unmount();
  });
});
