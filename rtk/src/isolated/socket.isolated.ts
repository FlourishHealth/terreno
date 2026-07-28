import {afterEach, beforeEach, describe, expect, it, mock, setSystemTime} from "bun:test";

// ---------------------------------------------------------------------------
// Mutable state the tests tweak between runs
// ---------------------------------------------------------------------------
let authToken: string | null = "token-abc";
let expirationTimes: {authRemainingSecs?: number; refreshRemainingSecs?: number} = {
  authRemainingSecs: 900,
  refreshRemainingSecs: 2_592_000,
};
let expirationError: Error | undefined;
let refreshError: Error | undefined;

const refreshAuthToken = mock(async (): Promise<void> => {
  if (refreshError) {
    throw refreshError;
  }
});

mock.module("../emptyApi", () => ({
  getFriendlyExpirationInfo: async () => "auth 15m / refresh 30d",
  getTokenExpirationTimes: async () => {
    if (expirationError) {
      throw expirationError;
    }
    return expirationTimes;
  },
  refreshAuthToken,
}));

interface TestState {
  auth: {lastTokenRefreshTimestamp: number | null};
}

mock.module("../authSlice", () => ({
  selectLastTokenRefreshTimestamp: (state: TestState) =>
    state.auth?.lastTokenRefreshTimestamp ?? null,
}));

const logAuth = mock((_message: string) => {});
mock.module("../constants", () => ({logAuth}));

let nextToastId = 0;
const toastShow = mock((_message: string, _options?: unknown) => `toast-${++nextToastId}`);
const toastHide = mock((_id: string) => {});
mock.module("@terreno/ui", () => ({
  useToast: () => ({hide: toastHide, show: toastShow}),
}));

interface FakeSocket {
  auth?: unknown;
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  handlers: Map<string, Set<(...args: unknown[]) => unknown>>;
  off: (event: string, handler: (...args: unknown[]) => unknown) => void;
  on: (event: string, handler: (...args: unknown[]) => unknown) => void;
  trigger: (event: string, ...args: unknown[]) => Promise<void>;
}

let socketInstances: FakeSocket[] = [];

const createFakeSocket = (): FakeSocket => {
  const handlers = new Map<string, Set<(...args: unknown[]) => unknown>>();
  const socket: FakeSocket = {
    connect: mock(() => {
      socket.connected = true;
    }),
    connected: false,
    disconnect: mock(() => {
      socket.connected = false;
    }),
    handlers,
    off: (event, handler) => {
      handlers.get(event)?.delete(handler);
    },
    on: (event, handler) => {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      handlers.get(event)?.add(handler);
    },
    trigger: async (event, ...args) => {
      for (const handler of [...(handlers.get(event) ?? [])]) {
        await handler(...args);
      }
    },
  };
  return socket;
};

const io = mock((_url: string, _options?: unknown) => {
  const socket = createFakeSocket();
  socketInstances.push(socket);
  return socket;
});
mock.module("socket.io-client", () => ({io}));

const {configureStore, createSlice} = await import("@reduxjs/toolkit");
const {act, renderHook} = await import("@testing-library/react-native");
const React = (await import("react")).default;
const {Provider} = await import("react-redux");
const {useSocketConnection} = await import("../socket");

const authSlice = createSlice({
  initialState: {lastTokenRefreshTimestamp: null as number | null},
  name: "auth",
  reducers: {
    tokenRefreshed: (state, action: {payload: number; type: string}) => {
      state.lastTokenRefreshTimestamp = action.payload;
    },
  },
});

type TestStore = ReturnType<typeof createStore>;

const createStore = () => configureStore({reducer: {auth: authSlice.reducer}});

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

interface RenderOptions {
  captureEvent?: (eventName: string, data: Record<string, unknown>) => void;
  onConnect?: () => void;
  onConnectError?: (error: Error) => void;
  onDisconnect?: () => void;
  onReconnectFailed?: () => void;
  shouldConnect?: boolean;
}

const renderSocket = async (
  options: RenderOptions = {}
): Promise<{
  rerender: (props: {shouldConnect: boolean}) => void;
  result: {current: ReturnType<typeof useSocketConnection>};
  socket: FakeSocket;
  store: TestStore;
}> => {
  const store = createStore();
  const Wrapper: React.FC<{children: React.ReactNode}> = ({children}) =>
    React.createElement(Provider, {children, store});
  const rendered = renderHook(
    ({shouldConnect}: {shouldConnect: boolean}) =>
      useSocketConnection({
        baseUrl: "http://localhost:4000",
        getAuthToken: async () => authToken,
        ...options,
        shouldConnect,
      }),
    {initialProps: {shouldConnect: options.shouldConnect ?? true}, wrapper: Wrapper}
  );
  await flush();
  return {
    rerender: rendered.rerender,
    result: rendered.result,
    socket: socketInstances[socketInstances.length - 1],
    store,
  };
};

/** setTimeout/setInterval callbacks the hook schedules, run manually by the tests. */
let scheduledTimeouts: (() => void)[] = [];
let scheduledIntervals: (() => Promise<void>)[] = [];
const originalSetTimeout = globalThis.setTimeout;
const originalSetInterval = globalThis.setInterval;

const runScheduledTimeouts = async (): Promise<void> => {
  const callbacks = [...scheduledTimeouts];
  scheduledTimeouts = [];
  await act(async () => {
    for (const callback of callbacks) {
      callback();
    }
  });
};

const runScheduledIntervals = async (): Promise<void> => {
  await act(async () => {
    for (const callback of [...scheduledIntervals]) {
      await callback();
    }
  });
};

beforeEach(() => {
  socketInstances = [];
  scheduledTimeouts = [];
  scheduledIntervals = [];
  authToken = "token-abc";
  expirationTimes = {authRemainingSecs: 900, refreshRemainingSecs: 2_592_000};
  expirationError = undefined;
  refreshError = undefined;
  refreshAuthToken.mockClear();
  toastShow.mockClear();
  toastHide.mockClear();
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {onLine: true},
  });
  globalThis.setTimeout = ((callback: () => void) => {
    scheduledTimeouts.push(callback);
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout;
  globalThis.setInterval = ((callback: () => Promise<void>) => {
    scheduledIntervals.push(callback);
    return 0 as unknown as ReturnType<typeof setInterval>;
  }) as unknown as typeof setInterval;
});

afterEach(() => {
  globalThis.setTimeout = originalSetTimeout;
  globalThis.setInterval = originalSetInterval;
  setSystemTime();
});

describe("useSocketConnection — connecting", () => {
  it("creates a socket and connects with a bearer token", async () => {
    const {socket} = await renderSocket();
    expect(io).toHaveBeenCalled();
    expect(socket.auth).toEqual({token: "Bearer token-abc"});
    expect(socket.connect).toHaveBeenCalled();
  });

  it("skips connecting when no token is available", async () => {
    authToken = null;
    const {socket} = await renderSocket();
    expect(socket.connect).not.toHaveBeenCalled();
  });

  it("disconnects when shouldConnect is false", async () => {
    const {result, socket} = await renderSocket({shouldConnect: false});
    expect(socket.disconnect).toHaveBeenCalled();
    expect(result.current.isSocketConnected.isConnected).toBe(false);
  });

  it("clears the connected state when shouldConnect flips to false", async () => {
    const {rerender, result, socket} = await renderSocket();
    await act(async () => {
      await socket.trigger("connect");
    });
    expect(result.current.isSocketConnected.isConnected).toBe(true);

    await act(async () => {
      rerender({shouldConnect: false});
    });
    await flush();

    expect(socket.disconnect).toHaveBeenCalled();
    expect(result.current.isSocketConnected.isConnected).toBe(false);
  });

  it("takes no action when already connected and shouldConnect stays true", async () => {
    const {rerender, socket} = await renderSocket();
    await act(async () => {
      await socket.trigger("connect");
    });
    const connectCalls = (socket.connect as ReturnType<typeof mock>).mock.calls.length;

    await act(async () => {
      rerender({shouldConnect: true});
    });
    await flush();

    expect((socket.connect as ReturnType<typeof mock>).mock.calls.length).toBe(connectCalls);
  });
});

describe("useSocketConnection — socket events", () => {
  it("marks connected and calls onConnect without a reconnected toast", async () => {
    const onConnect = mock(() => {});
    const {result, socket} = await renderSocket({onConnect});

    await act(async () => {
      await socket.trigger("connect");
    });

    expect(result.current.isSocketConnected.isConnected).toBe(true);
    expect(onConnect).toHaveBeenCalled();
    expect(toastShow).not.toHaveBeenCalled();
  });

  it("shows a reconnected toast when the outage lasted more than 10 seconds", async () => {
    const {socket} = await renderSocket();

    await act(async () => {
      await socket.trigger("disconnect", "transport close");
    });
    setSystemTime(new Date(Date.now() + 30_000));
    await act(async () => {
      await socket.trigger("connect");
    });

    expect(toastShow).toHaveBeenCalledWith("You have been reconnected.");
  });

  it("records the disconnect time, reports the event and checks the token", async () => {
    const captureEvent = mock((_name: string, _data: Record<string, unknown>) => {});
    const onDisconnect = mock(async () => {});
    const {result, socket} = await renderSocket({captureEvent, onDisconnect});

    await act(async () => {
      await socket.trigger("disconnect", "transport close");
    });

    expect(result.current.isSocketConnected.isConnected).toBe(false);
    expect(result.current.isSocketConnected.lastDisconnectedAt).toBeTruthy();
    expect(captureEvent).toHaveBeenCalledWith("WebSocket Disconnection", expect.any(Object));
    expect(onDisconnect).toHaveBeenCalled();
    expect(refreshAuthToken).not.toHaveBeenCalled();
  });

  it("refreshes an expiring token and reconnects on disconnect", async () => {
    expirationTimes = {authRemainingSecs: 10, refreshRemainingSecs: 100};
    const {socket} = await renderSocket();
    socket.connected = false;

    await act(async () => {
      await socket.trigger("disconnect", "io server disconnect");
    });

    expect(refreshAuthToken).toHaveBeenCalled();
    expect(socket.connect).toHaveBeenCalled();
  });

  it("shows a persistent error toast when the token refresh fails and clears it on connect", async () => {
    expirationTimes = {authRemainingSecs: 10, refreshRemainingSecs: 100};
    refreshError = new Error("refresh boom");
    const captureEvent = mock((_name: string, _data: Record<string, unknown>) => {});
    const {socket} = await renderSocket({captureEvent});

    await act(async () => {
      await socket.trigger("disconnect", "io server disconnect");
    });

    expect(captureEvent).toHaveBeenCalledWith(
      "WebSocket Token Check/Refresh Error on Disconnect",
      expect.any(Object)
    );
    expect(toastShow).toHaveBeenCalled();

    // A later successful connection dismisses the persistent error toast.
    await act(async () => {
      await socket.trigger("connect");
    });
    expect(toastHide).toHaveBeenCalled();
  });

  it("skips the error report when the refresh token is already expired", async () => {
    expirationError = new Error("no tokens");
    const captureEvent = mock((_name: string, _data: Record<string, unknown>) => {});
    const {socket} = await renderSocket({captureEvent});

    await act(async () => {
      await socket.trigger("disconnect", "transport error");
    });

    expect(captureEvent).not.toHaveBeenCalledWith(
      "WebSocket Token Check/Refresh Error on Disconnect",
      expect.any(Object)
    );
    expect(toastShow).toHaveBeenCalled();
  });

  it("reports connect errors and calls onConnectError", async () => {
    const captureEvent = mock((_name: string, _data: Record<string, unknown>) => {});
    const onConnectError = mock((_error: Error) => {});
    const {socket} = await renderSocket({captureEvent, onConnectError});

    await act(async () => {
      await socket.trigger("connect_error", new Error("handshake failed"));
    });

    expect(captureEvent).toHaveBeenCalledWith("WebSocket Connection Error", expect.any(Object));
    expect(onConnectError).toHaveBeenCalled();
  });

  it("ignores connect errors while the browser reports being offline", async () => {
    const captureEvent = mock((_name: string, _data: Record<string, unknown>) => {});
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {onLine: false},
    });
    const {socket} = await renderSocket({captureEvent});

    await act(async () => {
      await socket.trigger("connect_error", new Error("offline"));
    });

    expect(captureEvent).not.toHaveBeenCalled();
  });

  it("forces a new connection after reconnection attempts are exhausted", async () => {
    const captureEvent = mock((_name: string, _data: Record<string, unknown>) => {});
    const onReconnectFailed = mock(() => {});
    const {socket} = await renderSocket({captureEvent, onReconnectFailed});

    await act(async () => {
      await socket.trigger("reconnect_failed");
    });

    expect(captureEvent).toHaveBeenCalledWith("WebSocket Reconnect Failed", expect.any(Object));
    expect(socket.disconnect).toHaveBeenCalled();
    expect(onReconnectFailed).toHaveBeenCalled();

    const connectCalls = (socket.connect as ReturnType<typeof mock>).mock.calls.length;
    await runScheduledTimeouts();
    expect((socket.connect as ReturnType<typeof mock>).mock.calls.length).toBeGreaterThan(
      connectCalls
    );
  });

  it("does not reconnect after reconnect_failed when shouldConnect is false", async () => {
    const {socket} = await renderSocket({shouldConnect: false});

    await act(async () => {
      await socket.trigger("reconnect_failed");
    });
    await runScheduledTimeouts();

    expect(socket.connect).not.toHaveBeenCalled();
  });

  it("does not reconnect after reconnect_failed when the socket reconnected already", async () => {
    const {socket} = await renderSocket();
    await act(async () => {
      await socket.trigger("connect");
    });
    await act(async () => {
      await socket.trigger("reconnect_failed");
    });
    const connectCalls = (socket.connect as ReturnType<typeof mock>).mock.calls.length;

    await runScheduledTimeouts();

    expect((socket.connect as ReturnType<typeof mock>).mock.calls.length).toBe(connectCalls);
  });
});

describe("useSocketConnection — disconnected toast", () => {
  it("shows the disconnected toast after 9 seconds offline and hides it on reconnect", async () => {
    const {socket} = await renderSocket();

    await act(async () => {
      await socket.trigger("disconnect", "transport close");
    });
    await runScheduledIntervals();
    expect(toastShow).not.toHaveBeenCalledWith(
      "You have been disconnected. Attempting to reconnect...",
      expect.any(Object)
    );

    setSystemTime(new Date(Date.now() + 30_000));
    await runScheduledIntervals();
    expect(toastShow).toHaveBeenCalledWith(
      "You have been disconnected. Attempting to reconnect...",
      expect.any(Object)
    );

    // Reconnecting hides the toast and stops the polling interval.
    await act(async () => {
      await socket.trigger("connect");
    });
    expect(toastHide).toHaveBeenCalled();
    await runScheduledIntervals();
  });

  it("hides the disconnected toast when the outage is no longer stale", async () => {
    const {socket} = await renderSocket();

    await act(async () => {
      await socket.trigger("disconnect", "transport close");
    });
    const disconnectedAt = Date.now();
    setSystemTime(new Date(disconnectedAt + 30_000));
    await runScheduledIntervals();
    expect(toastShow).toHaveBeenCalledTimes(1);

    // Winding the clock back makes the outage look recent again.
    setSystemTime(new Date(disconnectedAt));
    await runScheduledIntervals();
    expect(toastHide).toHaveBeenCalled();
  });

  it("does not show the disconnected toast while a token error toast is shown", async () => {
    expirationError = new Error("no tokens");
    const {socket} = await renderSocket();

    await act(async () => {
      await socket.trigger("disconnect", "transport close");
    });
    toastShow.mockClear();
    setSystemTime(new Date(Date.now() + 30_000));
    await runScheduledIntervals();

    expect(toastShow).not.toHaveBeenCalled();
  });

  it("does not poll for the disconnected toast when shouldConnect is false", async () => {
    await renderSocket({shouldConnect: false});
    expect(scheduledIntervals.length).toBe(0);
  });
});

describe("useSocketConnection — redux token refresh signal", () => {
  it("reconnects and dismisses the error toast when the token refresh timestamp changes", async () => {
    expirationTimes = {authRemainingSecs: 10, refreshRemainingSecs: 100};
    refreshError = new Error("refresh boom");
    const {socket, store} = await renderSocket();

    // Trigger the persistent token error toast first.
    await act(async () => {
      await socket.trigger("disconnect", "io server disconnect");
    });
    expect(toastShow).toHaveBeenCalled();
    socket.connected = false;
    toastHide.mockClear();
    const connectCalls = (socket.connect as ReturnType<typeof mock>).mock.calls.length;

    await act(async () => {
      store.dispatch(authSlice.actions.tokenRefreshed(1_700_000_000_000));
    });
    await flush();

    expect(toastHide).toHaveBeenCalled();
    expect((socket.connect as ReturnType<typeof mock>).mock.calls.length).toBeGreaterThan(
      connectCalls
    );
  });
});
