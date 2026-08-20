/**
 * Isolated tests for socket.ts.
 *
 * These cover the token refresh reconnect path, which needs axios mocked so the
 * refresh call succeeds. The axios mock lives in its own process so it doesn't
 * leak into the rest of the package test run.
 */
import {afterEach, beforeEach, describe, it, mock} from "bun:test";
import {configureStore} from "@reduxjs/toolkit";
import {act, renderHook, waitFor} from "@testing-library/react-native";
import {assert} from "chai";
import React from "react";
import {Provider} from "react-redux";

const toast = {
  hide: (): void => {},
  show: (): string => "toast-1",
};

mock.module("@terreno/ui", () => ({useToast: () => toast}));

if (typeof globalThis.window === "undefined") {
  (globalThis as {window?: unknown}).window = {};
}

const storage = new Map<string, string>();

mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key: string): Promise<string | null> => storage.get(key) ?? null,
    removeItem: async (key: string): Promise<void> => {
      storage.delete(key);
    },
    setItem: async (key: string, value: string): Promise<void> => {
      storage.set(key, value);
    },
  },
}));

const axiosDefaults = {headers: {common: {} as Record<string, string>}};
const axiosPost = mock(async () => ({
  data: {data: {refreshToken: "new-refresh", token: "new-auth"}},
}));

mock.module("axios", () => ({
  default: {
    defaults: axiosDefaults,
    isAxiosError: (): boolean => false,
    post: axiosPost,
  },
}));

mock.module("axios-retry", () => ({
  default: Object.assign(() => {}, {exponentialDelay: () => 0}),
}));

type SocketHandler = (...args: unknown[]) => unknown;

interface MockSocket {
  auth: unknown;
  connect: () => void;
  connectCount: number;
  connected: boolean;
  disconnect: () => void;
  handlers: Map<string, SocketHandler[]>;
  off: (event: string, handler: SocketHandler) => void;
  on: (event: string, handler: SocketHandler) => void;
  trigger: (event: string, ...args: unknown[]) => Promise<void>;
}

const sockets: MockSocket[] = [];

const createMockSocket = (): MockSocket => {
  const socket: MockSocket = {
    auth: undefined,
    connect: (): void => {
      socket.connectCount += 1;
      socket.connected = true;
    },
    connectCount: 0,
    connected: false,
    disconnect: (): void => {
      socket.connected = false;
    },
    handlers: new Map<string, SocketHandler[]>(),
    off: (event, handler): void => {
      socket.handlers.set(
        event,
        (socket.handlers.get(event) ?? []).filter((h) => h !== handler)
      );
    },
    on: (event, handler): void => {
      socket.handlers.set(event, [...(socket.handlers.get(event) ?? []), handler]);
    },
    trigger: async (event, ...args): Promise<void> => {
      for (const handler of socket.handlers.get(event) ?? []) {
        await handler(...args);
      }
    },
  };
  return socket;
};

mock.module("socket.io-client", () => ({
  io: (): MockSocket => {
    const socket = createMockSocket();
    sockets.push(socket);
    return socket;
  },
}));

const {useSocketConnection} = await import("../socket");

interface AuthTestState {
  lastTokenRefreshTimestamp: number | null;
}

const createStore = () =>
  configureStore({
    reducer: {
      auth: (state: AuthTestState = {lastTokenRefreshTimestamp: null}): AuthTestState => state,
    },
  });

const createWrapper = (store: ReturnType<typeof createStore>) => {
  const Wrapper: React.FC<{children: React.ReactNode}> = ({children}) =>
    React.createElement(Provider, {children, store});
  return Wrapper;
};

/** A JWT-shaped token whose payload only needs an `exp` for getTokenExpirationTimes. */
const makeToken = (expiresInSecs: number): string => {
  const payload = Buffer.from(
    JSON.stringify({exp: Math.floor(Date.now() / 1000) + expiresInSecs})
  ).toString("base64url");
  return `header.${payload}.signature`;
};

const renderSocket = (overrides: Record<string, unknown> = {}) =>
  renderHook(
    () =>
      useSocketConnection({
        baseUrl: "https://example.com",
        getAuthToken: async () => "auth-token",
        shouldConnect: true,
        ...overrides,
      }),
    {wrapper: createWrapper(createStore())}
  );

const lastSocket = (): MockSocket => {
  const socket = sockets[sockets.length - 1];
  if (!socket) {
    throw new Error("No socket was created");
  }
  return socket;
};

describe("useSocketConnection token refresh reconnect", () => {
  beforeEach(() => {
    sockets.length = 0;
    storage.clear();
    axiosPost.mockClear();
    Object.defineProperty(globalThis, "navigator", {configurable: true, value: {onLine: true}});
  });

  afterEach(() => {
    storage.clear();
  });

  it("reconnects the socket once the token has been refreshed", async () => {
    // A nearly expired auth token triggers a refresh, which now succeeds.
    storage.set("AUTH_TOKEN", makeToken(10));
    storage.set("REFRESH_TOKEN", makeToken(3600));

    renderSocket();
    await waitFor(() => {
      assert.lengthOf(sockets, 1);
    });

    const socket = lastSocket();
    socket.disconnect();
    const connectCountBefore = socket.connectCount;

    await act(async () => {
      await socket.trigger("disconnect", "transport error");
    });

    assert.equal(axiosPost.mock.calls.length, 1);
    assert.isAbove(socket.connectCount, connectCountBefore);
    assert.isTrue(socket.connected);
    // The refreshed tokens are persisted for the next request.
    assert.equal(storage.get("AUTH_TOKEN"), "new-auth");
  });

  it("does not reconnect after a refresh when shouldConnect is false", async () => {
    storage.set("AUTH_TOKEN", makeToken(10));
    storage.set("REFRESH_TOKEN", makeToken(3600));

    renderSocket({shouldConnect: false});
    await waitFor(() => {
      assert.lengthOf(sockets, 1);
    });

    const socket = lastSocket();
    const connectCountBefore = socket.connectCount;

    await act(async () => {
      await socket.trigger("disconnect", "transport error");
    });

    assert.equal(axiosPost.mock.calls.length, 1);
    assert.equal(socket.connectCount, connectCountBefore);
  });

  it("skips the forced reconnect when the socket is no longer initialized", async () => {
    const {unmount} = renderSocket();
    await waitFor(() => {
      assert.lengthOf(sockets, 1);
    });

    const socket = lastSocket();
    await act(async () => {
      await socket.trigger("reconnect_failed");
    });
    const connectCountBefore = socket.connectCount;

    // Unmounting clears the socket ref before the scheduled reconnect fires.
    unmount();
    await new Promise((resolve) => setTimeout(resolve, 2200));

    assert.equal(socket.connectCount, connectCountBefore);
    assert.isFalse(socket.connected);
  });
});
