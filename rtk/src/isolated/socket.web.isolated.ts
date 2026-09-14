import {afterEach, beforeEach, describe, expect, it, mock, setSystemTime} from "bun:test";

// ---------------------------------------------------------------------------
// Controllable state that tests tweak between runs
// ---------------------------------------------------------------------------
let authToken: string | null = "auth-token";
const getAuthToken = mock(async (): Promise<string | null> => authToken);

let expirationTimes: {authRemainingSecs?: number; refreshRemainingSecs?: number} = {
  authRemainingSecs: 3600,
  refreshRemainingSecs: 7200,
};
let expirationThrows = false;
const mockGetTokenExpirationTimes = mock(
  async (): Promise<{authRemainingSecs?: number; refreshRemainingSecs?: number}> => {
    if (expirationThrows) {
      throw new Error("expiration lookup failed");
    }
    return expirationTimes;
  }
);
let refreshThrows = false;
const mockRefreshAuthToken = mock(async (): Promise<void> => {
  if (refreshThrows) {
    throw new Error("refresh failed");
  }
});
const mockGetFriendlyExpirationInfo = mock(async (): Promise<string> => "friendly-token-info");

mock.module("../emptyApi", () => ({
  getFriendlyExpirationInfo: mockGetFriendlyExpirationInfo,
  getTokenExpirationTimes: mockGetTokenExpirationTimes,
  refreshAuthToken: mockRefreshAuthToken,
}));

// Toast mock
let toastIdCounter = 0;
const mockToastShow = mock(
  (_message: string, _opts?: unknown): string => `toast-${++toastIdCounter}`
);
const mockToastHide = mock((_id: string): void => {});
mock.module("@terreno/ui", () => ({
  useToast: () => ({hide: mockToastHide, show: mockToastShow}),
}));

// react-redux useSelector returns the controllable timestamp
let reduxTimestamp: number | null = null;
mock.module("react-redux", () => ({
  useSelector: (): number | null => reduxTimestamp,
}));

// socket.io-client mock
interface MockSocket {
  auth: unknown;
  connected: boolean;
  handlers: Record<string, (arg?: unknown) => unknown>;
  connect: ReturnType<typeof mock>;
  disconnect: ReturnType<typeof mock>;
  off: ReturnType<typeof mock>;
  on: ReturnType<typeof mock>;
}

let currentSocket: MockSocket;

const makeSocket = (): MockSocket => {
  const socket = {
    auth: undefined as unknown,
    connected: false,
    handlers: {} as Record<string, (arg?: unknown) => unknown>,
  } as MockSocket;
  socket.on = mock((event: string, handler: (arg?: unknown) => unknown): MockSocket => {
    socket.handlers[event] = handler;
    return socket;
  });
  socket.off = mock((event: string): MockSocket => {
    delete socket.handlers[event];
    return socket;
  });
  socket.connect = mock((): MockSocket => socket);
  socket.disconnect = mock((): MockSocket => {
    socket.connected = false;
    return socket;
  });
  return socket;
};

const mockIo = mock((): MockSocket => {
  currentSocket = makeSocket();
  return currentSocket;
});
mock.module("socket.io-client", () => ({io: mockIo}));

// ---------------------------------------------------------------------------
// Timer mocks (bun has no fake timers) — capture callbacks to invoke manually
// ---------------------------------------------------------------------------
const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;
const originalSetTimeout = globalThis.setTimeout;
const originalClearTimeout = globalThis.clearTimeout;

let intervalCallbacks: Array<() => void | Promise<void>> = [];
let timeoutCallbacks: Array<() => void> = [];
let idCounter = 0;

// ---------------------------------------------------------------------------
// Deferred imports (after mocks are installed)
// ---------------------------------------------------------------------------
const {act, renderHook, waitFor} = await import("@testing-library/react-native");
const {useSocketConnection} = await import("../socket");

const flushPromises = (): Promise<void> => new Promise((r) => originalSetTimeout(r, 0));

const emit = async (event: string, arg?: unknown): Promise<void> => {
  await act(async () => {
    if (event === "connect") {
      currentSocket.connected = true;
    } else if (event === "disconnect") {
      currentSocket.connected = false;
    }
    await currentSocket.handlers[event]?.(arg);
    await flushPromises();
  });
};

interface HookOptions {
  baseUrl: string;
  getAuthToken: () => Promise<string | null>;
  shouldConnect: boolean;
  captureEvent?: (eventName: string, data: Record<string, unknown>) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onConnectError?: (error: Error) => void;
  onReconnectFailed?: () => void;
}

const defaultOptions = (overrides: Partial<HookOptions> = {}): HookOptions => ({
  baseUrl: "https://example.com",
  getAuthToken,
  shouldConnect: true,
  ...overrides,
});

beforeEach(() => {
  authToken = "auth-token";
  expirationTimes = {authRemainingSecs: 3600, refreshRemainingSecs: 7200};
  expirationThrows = false;
  refreshThrows = false;
  reduxTimestamp = null;
  toastIdCounter = 0;
  intervalCallbacks = [];
  timeoutCallbacks = [];
  idCounter = 0;

  getAuthToken.mockClear();
  mockGetTokenExpirationTimes.mockClear();
  mockRefreshAuthToken.mockClear();
  mockGetFriendlyExpirationInfo.mockClear();
  mockToastShow.mockClear();
  mockToastHide.mockClear();
  mockIo.mockClear();

  globalThis.setInterval = mock((cb: () => void | Promise<void>): number => {
    intervalCallbacks.push(cb);
    return ++idCounter;
  }) as unknown as typeof setInterval;
  globalThis.clearInterval = mock((): void => {}) as unknown as typeof clearInterval;
  globalThis.setTimeout = mock((cb: () => void): number => {
    timeoutCallbacks.push(cb);
    return ++idCounter;
  }) as unknown as typeof setTimeout;
  globalThis.clearTimeout = mock((): void => {}) as unknown as typeof clearTimeout;

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {onLine: true},
    writable: true,
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
    writable: true,
  });
});

afterEach(() => {
  globalThis.setInterval = originalSetInterval;
  globalThis.clearInterval = originalClearInterval;
  globalThis.setTimeout = originalSetTimeout;
  globalThis.clearTimeout = originalClearTimeout;
  setSystemTime();
});

describe("useSocketConnection", () => {
  it("initializes a socket and connects with the auth token when shouldConnect is true", async () => {
    const {result} = renderHook(() => useSocketConnection(defaultOptions()));
    await act(async () => {
      await flushPromises();
    });
    expect(mockIo).toHaveBeenCalledWith("https://example.com", expect.any(Object));
    expect(getAuthToken).toHaveBeenCalled();
    expect(currentSocket.connect).toHaveBeenCalled();
    expect(currentSocket.auth).toEqual({token: "Bearer auth-token"});
    expect(result.current.socket).toBeTruthy();
  });

  it("warns and skips connecting when getAuthToken returns no token", async () => {
    authToken = null;
    renderHook(() => useSocketConnection(defaultOptions()));
    await act(async () => {
      await flushPromises();
    });
    expect(currentSocket.connect).not.toHaveBeenCalled();
  });

  it("does not connect when shouldConnect is false", async () => {
    renderHook(() => useSocketConnection(defaultOptions({shouldConnect: false})));
    await act(async () => {
      await flushPromises();
    });
    expect(currentSocket.connect).not.toHaveBeenCalled();
    expect(currentSocket.disconnect).toHaveBeenCalled();
  });

  it("handles the connect event and invokes onConnect", async () => {
    const onConnect = mock(() => {});
    const {result} = renderHook(() => useSocketConnection(defaultOptions({onConnect})));
    await act(async () => {
      await flushPromises();
    });
    await emit("connect");
    expect(onConnect).toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current.isSocketConnected.isConnected).toBe(true);
    });
  });

  it("shows a reconnected toast when reconnecting after more than 10 seconds", async () => {
    setSystemTime(new Date("2024-01-01T00:00:00Z"));
    const {result} = renderHook(() => useSocketConnection(defaultOptions()));
    await act(async () => {
      await flushPromises();
    });
    await emit("connect");
    await emit("disconnect", "transport close");
    await waitFor(() => {
      expect(result.current.isSocketConnected.lastDisconnectedAt).not.toBeNull();
    });
    setSystemTime(new Date("2024-01-01T00:00:20Z"));
    mockToastShow.mockClear();
    await emit("connect");
    expect(mockToastShow).toHaveBeenCalledWith("You have been reconnected.");
  });

  it("refreshes the token on disconnect when tokens are near expiration and reconnects", async () => {
    expirationTimes = {authRemainingSecs: 30, refreshRemainingSecs: 30};
    const onDisconnect = mock(() => {});
    renderHook(() => useSocketConnection(defaultOptions({onDisconnect})));
    await act(async () => {
      await flushPromises();
    });
    currentSocket.connect.mockClear();
    await emit("disconnect", "transport error");
    expect(mockRefreshAuthToken).toHaveBeenCalled();
    expect(currentSocket.connect).toHaveBeenCalled();
    expect(onDisconnect).toHaveBeenCalled();
  });

  it("shows an error toast when token expiration lookup fails on disconnect", async () => {
    expirationThrows = true;
    renderHook(() => useSocketConnection(defaultOptions()));
    await act(async () => {
      await flushPromises();
    });
    await emit("disconnect", "transport error");
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.stringContaining("Error refreshing token"),
      expect.objectContaining({persistent: true, variant: "error"})
    );
  });

  it("captures an event when refresh fails but the refresh token is still valid", async () => {
    expirationTimes = {authRemainingSecs: 10, refreshRemainingSecs: 30};
    refreshThrows = true;
    const captureEvent = mock((_name: string, _data?: Record<string, unknown>) => {});
    renderHook(() => useSocketConnection(defaultOptions({captureEvent})));
    await act(async () => {
      await flushPromises();
    });
    await emit("disconnect", "transport error");
    expect(mockGetFriendlyExpirationInfo).toHaveBeenCalled();
    const captured = captureEvent.mock.calls.some(
      (call) => typeof call[0] === "string" && call[0].includes("Token Check/Refresh Error")
    );
    expect(captured).toBe(true);
  });

  it("skips connect_error handling while the browser is offline", async () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {onLine: false},
      writable: true,
    });
    const onConnectError = mock(() => {});
    renderHook(() => useSocketConnection(defaultOptions({onConnectError})));
    await act(async () => {
      await flushPromises();
    });
    await emit("connect_error", new Error("boom"));
    expect(onConnectError).not.toHaveBeenCalled();
  });

  it("handles connect_error when online and invokes onConnectError", async () => {
    const captureEvent = mock((_name: string, _data?: Record<string, unknown>) => {});
    const onConnectError = mock(() => {});
    renderHook(() => useSocketConnection(defaultOptions({captureEvent, onConnectError})));
    await act(async () => {
      await flushPromises();
    });
    await emit("connect_error", new Error("kaboom"));
    expect(onConnectError).toHaveBeenCalled();
    const captured = captureEvent.mock.calls.some(
      (call) => call[0] === "WebSocket Connection Error"
    );
    expect(captured).toBe(true);
  });

  it("handles reconnect_failed, forcing a new connection attempt", async () => {
    const onReconnectFailed = mock(() => {});
    renderHook(() => useSocketConnection(defaultOptions({onReconnectFailed})));
    await act(async () => {
      await flushPromises();
    });
    currentSocket.connect.mockClear();
    await emit("reconnect_failed");
    expect(currentSocket.disconnect).toHaveBeenCalled();
    expect(onReconnectFailed).toHaveBeenCalled();
    // Run the deferred setTimeout callback that forces a reconnection.
    await act(async () => {
      timeoutCallbacks.forEach((cb) => {
        cb();
      });
      await flushPromises();
    });
    expect(currentSocket.connect).toHaveBeenCalled();
  });

  it("does not reconnect after reconnect_failed when shouldConnect is false", async () => {
    const {rerender} = renderHook((props: HookOptions) => useSocketConnection(props), {
      initialProps: defaultOptions(),
    });
    await act(async () => {
      await flushPromises();
    });
    // connect first so we have a live connection, then flip shouldConnect off
    await emit("connect");
    rerender(defaultOptions({shouldConnect: false}));
    await act(async () => {
      await flushPromises();
    });
    currentSocket.connect.mockClear();
    await emit("reconnect_failed");
    await act(async () => {
      timeoutCallbacks.forEach((cb) => {
        cb();
      });
      await flushPromises();
    });
    expect(currentSocket.connect).not.toHaveBeenCalled();
  });

  it("shows and hides the disconnected toast based on connection state", async () => {
    setSystemTime(new Date("2024-01-01T00:00:00Z"));
    const {result} = renderHook(() => useSocketConnection(defaultOptions()));
    await act(async () => {
      await flushPromises();
    });
    await emit("connect");
    await emit("disconnect", "transport close");
    await waitFor(() => {
      expect(result.current.isSocketConnected.lastDisconnectedAt).not.toBeNull();
    });

    // More than 9 seconds since disconnect → the interval should show the toast.
    setSystemTime(new Date("2024-01-01T00:00:15Z"));
    mockToastShow.mockClear();
    await act(async () => {
      await Promise.all(intervalCallbacks.map((cb) => cb()));
      await flushPromises();
    });
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.stringContaining("You have been disconnected"),
      expect.objectContaining({persistent: true})
    );

    // Reconnect → the connect handler hides the disconnected toast.
    mockToastHide.mockClear();
    await emit("connect");
    expect(mockToastHide).toHaveBeenCalled();
  });

  it("reconnects when a redux token refresh timestamp changes", async () => {
    const {rerender} = renderHook((props: HookOptions) => useSocketConnection(props), {
      initialProps: defaultOptions(),
    });
    await act(async () => {
      await flushPromises();
    });
    getAuthToken.mockClear();
    reduxTimestamp = Date.now();
    await act(async () => {
      rerender(defaultOptions());
      await flushPromises();
    });
    expect(getAuthToken).toHaveBeenCalled();
  });

  it("dismisses the socket on unmount", async () => {
    const {unmount} = renderHook(() => useSocketConnection(defaultOptions()));
    await act(async () => {
      await flushPromises();
    });
    const socket = currentSocket;
    unmount();
    expect(socket.disconnect).toHaveBeenCalled();
  });
});
