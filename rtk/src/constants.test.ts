import {afterAll, beforeEach, describe, expect, it, mock} from "bun:test";

interface MockExpoConstants {
  experienceUrl?: string;
  expoConfig?: {
    extra?: Record<string, string | undefined>;
    hostUri?: string;
  };
  expoGoConfig?: {
    debuggerHost?: string;
  };
}

const getExpoConstants = async (): Promise<MockExpoConstants> => {
  const expoConstantsModule = (await import("expo-constants")) as {
    default: MockExpoConstants;
  };
  return expoConstantsModule.default;
};

const importConstantsModule = async ({
  apiUrl,
  isDev,
  mockExpoConstants,
}: {
  apiUrl?: string;
  isDev: boolean;
  mockExpoConstants: MockExpoConstants;
}): Promise<typeof import("./constants")> => {
  const expoConstants = await getExpoConstants();
  expoConstants.experienceUrl = mockExpoConstants.experienceUrl;
  expoConstants.expoConfig = mockExpoConstants.expoConfig;
  expoConstants.expoGoConfig = mockExpoConstants.expoGoConfig;

  if (apiUrl) {
    process.env.EXPO_PUBLIC_API_URL = apiUrl;
  } else {
    delete process.env.EXPO_PUBLIC_API_URL;
  }

  (globalThis as {__DEV__?: boolean}).__DEV__ = isDev;

  return import(`./constants.ts?cacheBust=${Date.now()}-${Math.random()}`);
};

describe("constants", () => {
  const originalConsoleDebug = console.debug;
  const originalConsoleError = console.error;
  let debugMock = mock(() => {});
  let errorMock = mock(() => {});

  beforeEach(() => {
    debugMock = mock(() => {});
    errorMock = mock(() => {});
    console.debug = debugMock;
    console.error = errorMock;
    delete process.env.EXPO_PUBLIC_API_URL;
    (globalThis as {__DEV__?: boolean}).__DEV__ = undefined;
  });

  afterAll(() => {
    console.debug = originalConsoleDebug;
    console.error = originalConsoleError;
    delete process.env.EXPO_PUBLIC_API_URL;
    (globalThis as {__DEV__?: boolean}).__DEV__ = undefined;
  });

  it("prefers EXPO_PUBLIC_API_URL over other base URL sources", async () => {
    const constants = await importConstantsModule({
      apiUrl: "https://api.example.com",
      isDev: true,
      mockExpoConstants: {
        expoConfig: {
          extra: {APP_ENV: "staging", BASE_URL: "https://api.should-not-win.com"},
          hostUri: "192.168.1.22:19000",
        },
      },
    });

    expect(constants.baseUrl).toBe("https://api.example.com");
    expect(constants.baseWebsocketsUrl).toBe("https://ws.example.com/");
    expect(constants.baseTasksUrl).toBe("https://tasks.example.com/tasks");
  });

  it("uses hostUri-derived URLs for dev simulator mode", async () => {
    const constants = await importConstantsModule({
      isDev: true,
      mockExpoConstants: {
        expoConfig: {
          extra: {},
          hostUri: "10.0.0.15:19000",
        },
      },
    });

    expect(constants.baseUrl).toBe("http://10.0.0.15:4000");
    expect(constants.baseWebsocketsUrl).toBe("ws://10.0.0.15:4000/");
    expect(constants.baseTasksUrl).toBe("http://10.0.0.15:4000/tasks");
  });

  it("uses experienceUrl-derived URLs for dev web mode", async () => {
    const constants = await importConstantsModule({
      isDev: true,
      mockExpoConstants: {
        experienceUrl: "exp://10.11.12.13:19000",
        expoConfig: {extra: {}},
      },
    });

    expect(constants.baseUrl).toBe("http://10.11.12.13:4000");
    expect(constants.baseWebsocketsUrl).toBe("ws://10.11.12.13:4000/");
    expect(constants.baseTasksUrl).toBe("http://10.11.12.13:4000/tasks");
  });

  it("falls back to localhost when no URL source is available", async () => {
    const constants = await importConstantsModule({
      isDev: false,
      mockExpoConstants: {expoConfig: {extra: {}}},
    });

    expect(constants.baseUrl).toBe("http://localhost:4000");
    expect(constants.baseWebsocketsUrl).toBe("ws://localhost:4000/");
    expect(constants.baseTasksUrl).toBe("http://localhost:4000/tasks");
  });

  it("uses BASE_URL for non-dev environments", async () => {
    const constants = await importConstantsModule({
      isDev: false,
      mockExpoConstants: {
        expoConfig: {extra: {APP_ENV: "production", BASE_URL: "https://api.prod.example.com"}},
      },
    });

    expect(constants.baseUrl).toBe("https://api.prod.example.com");
    expect(constants.baseWebsocketsUrl).toBe("https://ws.prod.example.com/");
    expect(constants.baseTasksUrl).toBe("https://tasks.prod.example.com/tasks");
  });

  it("logs auth and websocket messages when debug flags are enabled", async () => {
    const constants = await importConstantsModule({
      isDev: false,
      mockExpoConstants: {
        expoConfig: {extra: {AUTH_DEBUG: "true", WEBSOCKETS_DEBUG: "true"}},
      },
    });

    constants.logAuth("auth test message");
    constants.logSocket(undefined, "socket test message");

    expect(debugMock.mock.calls.some((call) => call[0] === "AUTH_DEBUG is enabled")).toBeTrue();
    expect(
      debugMock.mock.calls.some(
        (call) => call[0] === "[websocket]" && call.includes("socket test message")
      )
    ).toBeTrue();
  });

  it("logs socket messages when user websocket feature flag is enabled", async () => {
    const constants = await importConstantsModule({
      isDev: false,
      mockExpoConstants: {
        expoConfig: {extra: {WEBSOCKETS_DEBUG: "false"}},
      },
    });

    constants.logSocket({featureFlags: {debugWebsockets: {enabled: true}}}, "feature-flag socket");

    expect(
      debugMock.mock.calls.some(
        (call) => call[0] === "[websocket]" && call.includes("feature-flag socket")
      )
    ).toBeTrue();
  });

  it("warns when expo tunnel debugger host is detected", async () => {
    await importConstantsModule({
      isDev: false,
      mockExpoConstants: {
        expoConfig: {extra: {}},
        expoGoConfig: {debuggerHost: "random.exp.direct:8081"},
      },
    });

    expect(errorMock).toHaveBeenCalledTimes(1);
    expect(errorMock.mock.calls[0]?.[0]).toContain("Expo Tunnel is not currently supported");
  });
});
