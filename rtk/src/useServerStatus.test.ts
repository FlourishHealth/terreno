import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import {configureStore} from "@reduxjs/toolkit";
import {act, renderHook} from "@testing-library/react-native";
import React from "react";
import {Provider} from "react-redux";

import {offlineReducer, setOnlineStatus} from "./offlineSlice";
import {useServerStatus} from "./useServerStatus";

const createTestStore = () =>
  configureStore({
    reducer: {offline: offlineReducer},
  });

const createWrapper = (store: ReturnType<typeof createTestStore>) => {
  const Wrapper: React.FC<{children: React.ReactNode}> = ({children}) =>
    React.createElement(Provider, {children, store});
  return Wrapper;
};

interface MockWindow {
  addEventListener: (event: string, handler: () => void) => void;
  removeEventListener: (event: string, handler: () => void) => void;
  _listeners: Map<string, Set<() => void>>;
  _dispatch: (event: string) => void;
}

const createMockWindow = (): MockWindow => {
  const listeners = new Map<string, Set<() => void>>();
  return {
    _dispatch: (event: string) => {
      for (const handler of listeners.get(event) ?? []) {
        handler();
      }
    },
    _listeners: listeners,
    addEventListener: (event: string, handler: () => void) => {
      if (!listeners.has(event)) {
        listeners.set(event, new Set());
      }
      listeners.get(event)?.add(handler);
    },
    removeEventListener: (event: string, handler: () => void) => {
      listeners.get(event)?.delete(handler);
    },
  };
};

describe("useServerStatus", () => {
  let store: ReturnType<typeof createTestStore>;
  let originalFetch: typeof globalThis.fetch;
  let mockWindow: MockWindow;

  beforeEach(() => {
    store = createTestStore();
    originalFetch = globalThis.fetch;
    mockWindow = createMockWindow();
    (globalThis as Record<string, unknown>).window = mockWindow;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns initial online state from offlineSlice", () => {
    globalThis.fetch = mock(
      async () => new Response("ok", {status: 200})
    ) as unknown as typeof fetch;

    const {result, unmount} = renderHook(() => useServerStatus({skip: true}), {
      wrapper: createWrapper(store),
    });

    expect(result.current.isOnline).toBe(true);
    expect(result.current.queueLength).toBe(0);
    expect(result.current.isSyncing).toBe(false);
    unmount();
  });

  it("skips polling when skip is true", async () => {
    const fetchFn = mock(async () => new Response("ok", {status: 200}));
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {unmount} = renderHook(() => useServerStatus({skip: true}), {
      wrapper: createWrapper(store),
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(fetchFn).not.toHaveBeenCalled();
    unmount();
  });

  it("dispatches online status when health check succeeds", async () => {
    store.dispatch(setOnlineStatus(false));
    const fetchFn = mock(async () => new Response("ok", {status: 200}));
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {unmount} = renderHook(
      () =>
        useServerStatus({
          healthUrl: "http://localhost:4000/health",
          pollIntervalMs: 60_000,
        }),
      {wrapper: createWrapper(store)}
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(fetchFn).toHaveBeenCalled();
    expect(store.getState().offline.isOnline).toBe(true);
    unmount();
  });

  it("dispatches offline status when health check returns non-ok", async () => {
    const fetchFn = mock(async () => new Response("error", {status: 500}));
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {unmount} = renderHook(
      () =>
        useServerStatus({
          healthUrl: "http://localhost:4000/health",
          pollIntervalMs: 60_000,
        }),
      {wrapper: createWrapper(store)}
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(fetchFn).toHaveBeenCalled();
    expect(store.getState().offline.isOnline).toBe(false);
    unmount();
  });

  it("dispatches offline status when health check throws", async () => {
    const fetchFn = mock(async () => {
      throw new Error("Network error");
    });
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {unmount} = renderHook(
      () =>
        useServerStatus({
          healthUrl: "http://localhost:4000/health",
          pollIntervalMs: 60_000,
        }),
      {wrapper: createWrapper(store)}
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(fetchFn).toHaveBeenCalled();
    expect(store.getState().offline.isOnline).toBe(false);
    unmount();
  });

  it("does not change status when health succeeds and already online", async () => {
    const fetchFn = mock(async () => new Response("ok", {status: 200}));
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {unmount} = renderHook(
      () =>
        useServerStatus({
          healthUrl: "http://localhost:4000/health",
          pollIntervalMs: 60_000,
        }),
      {wrapper: createWrapper(store)}
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(fetchFn).toHaveBeenCalled();
    expect(store.getState().offline.isOnline).toBe(true);
    unmount();
  });

  it("accepts custom health URL", async () => {
    const fetchFn = mock(async () => new Response("ok", {status: 200}));
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {unmount} = renderHook(
      () =>
        useServerStatus({
          healthUrl: "http://custom-api:3000/ping",
          pollIntervalMs: 60_000,
          skip: false,
        }),
      {wrapper: createWrapper(store)}
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(fetchFn).toHaveBeenCalled();
    const callUrl = (fetchFn.mock.calls[0] as unknown[])[0] as string;
    expect(callUrl).toBe("http://custom-api:3000/ping");
    unmount();
  });

  it("dispatches offline when browser fires offline event", async () => {
    const fetchFn = mock(async () => new Response("ok", {status: 200}));
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {unmount} = renderHook(
      () =>
        useServerStatus({
          healthUrl: "http://localhost:4000/health",
          pollIntervalMs: 60_000,
        }),
      {wrapper: createWrapper(store)}
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(store.getState().offline.isOnline).toBe(true);

    act(() => {
      mockWindow._dispatch("offline");
    });

    expect(store.getState().offline.isOnline).toBe(false);
    unmount();
  });

  it("polls again after the online interval elapses", async () => {
    const fetchFn = mock(async () => new Response("ok", {status: 200}));
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {unmount} = renderHook(
      () =>
        useServerStatus({
          healthUrl: "http://localhost:4000/health",
          pollIntervalMs: 20,
        }),
      {wrapper: createWrapper(store)}
    );

    // Wait long enough for several interval ticks to fire the setInterval callback.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 120));
    });

    expect(fetchFn.mock.calls.length).toBeGreaterThan(1);
    unmount();
  });

  it("aborts the in-flight health check once the request timeout fires", async () => {
    const originalSetTimeout = globalThis.setTimeout;
    // Fire the 4000ms abort timer synchronously so controller.abort() runs.
    globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      if (timeout === 4_000 && typeof handler === "function") {
        (handler as () => void)();
        return 0;
      }
      return originalSetTimeout(handler, timeout as number, ...(args as []));
    }) as unknown as typeof globalThis.setTimeout;

    const fetchFn = mock(
      (_url: string, init?: {signal?: AbortSignal}) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            reject(new Error("aborted"));
            return;
          }
          signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    );
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    try {
      const {unmount} = renderHook(
        () =>
          useServerStatus({
            healthUrl: "http://localhost:4000/health",
            pollIntervalMs: 60_000,
          }),
        {wrapper: createWrapper(store)}
      );

      await act(async () => {
        await new Promise((resolve) => originalSetTimeout(resolve, 50));
      });

      expect(fetchFn).toHaveBeenCalled();
      expect(store.getState().offline.isOnline).toBe(false);
      unmount();
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });

  it("triggers health check when browser fires online event", async () => {
    store.dispatch(setOnlineStatus(false));
    const fetchFn = mock(async () => new Response("ok", {status: 200}));
    globalThis.fetch = fetchFn as unknown as typeof fetch;

    const {unmount} = renderHook(
      () =>
        useServerStatus({
          healthUrl: "http://localhost:4000/health",
          pollIntervalMs: 60_000,
        }),
      {wrapper: createWrapper(store)}
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    fetchFn.mockClear();

    await act(async () => {
      mockWindow._dispatch("online");
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    expect(fetchFn).toHaveBeenCalled();
    unmount();
  });
});
