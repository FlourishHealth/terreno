import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";

type ConstantsModule = typeof import("./constants");

type ExpoConstantsMock = {
  experienceUrl?: string;
  expoConfig?: {
    extra?: Record<string, string>;
    hostUri?: string;
  };
  expoGoConfig?: {
    debuggerHost?: string;
  };
};

const loadConstantsModule = async ({
  apiUrl,
  constantsMock,
  isDev = false,
}: {
  apiUrl?: string;
  constantsMock: ExpoConstantsMock;
  isDev?: boolean;
}): Promise<ConstantsModule> => {
  const hasApiUrl = "EXPO_PUBLIC_API_URL" in process.env;
  const previousApiUrl = process.env.EXPO_PUBLIC_API_URL;
  const previousDev = (globalThis as {__DEV__?: boolean}).__DEV__;

  if (apiUrl) {
    process.env.EXPO_PUBLIC_API_URL = apiUrl;
  } else {
    delete process.env.EXPO_PUBLIC_API_URL;
  }

  (globalThis as {__DEV__?: boolean}).__DEV__ = isDev;

  mock.module("expo-constants", () => ({
    default: constantsMock,
  }));

  const testCaseId = `${Date.now()}-${Math.random()}`;
  const module = (await import(`./constants?testCase=${testCaseId}`)) as ConstantsModule;

  if (hasApiUrl) {
    process.env.EXPO_PUBLIC_API_URL = previousApiUrl;
  } else {
    delete process.env.EXPO_PUBLIC_API_URL;
  }

  if (typeof previousDev === "undefined") {
    delete (globalThis as {__DEV__?: boolean}).__DEV__;
  } else {
    (globalThis as {__DEV__?: boolean}).__DEV__ = previousDev;
  }

  return module;
};

describe("constants", () => {
  const originalDebug = console.debug;
  const originalError = console.error;

  beforeEach(() => {
    console.debug = mock(() => {});
    console.error = mock(() => {});
  });

  afterEach(() => {
    console.debug = originalDebug;
    console.error = originalError;
  });

  it("uses EXPO_PUBLIC_API_URL override and enables debug logs", async () => {
    const constants = await loadConstantsModule({
      apiUrl: "https://api.example.com",
      constantsMock: {
        expoConfig: {
          extra: {
            APP_ENV: "production",
            AUTH_DEBUG: "true",
            WEBSOCKETS_DEBUG: "true",
          },
        },
      },
      isDev: false,
    });

    expect(constants.baseUrl).toBe("https://api.example.com");
    expect(constants.baseWebsocketsUrl).toBe("https://ws.example.com/");
    expect(constants.baseTasksUrl).toBe("https://tasks.example.com/tasks");
    expect(constants.AUTH_DEBUG).toBe(true);

    constants.logAuth("auth message");
    constants.logSocket(undefined, "socket message");

    expect(console.debug).toHaveBeenCalledWith("auth message");
    expect(console.debug).toHaveBeenCalledWith("[websocket]", "socket message");
  });

  it("resolves dev hostUri URLs when __DEV__ is true", async () => {
    const constants = await loadConstantsModule({
      constantsMock: {
        expoConfig: {
          extra: {},
          hostUri: "10.0.0.12:8081",
        },
      },
      isDev: true,
    });

    expect(constants.baseUrl).toBe("http://10.0.0.12:4000");
    expect(constants.baseWebsocketsUrl).toBe("ws://10.0.0.12:4000/");
    expect(constants.baseTasksUrl).toBe("http://10.0.0.12:4000/tasks");
  });

  it("resolves dev experienceUrl URLs when hostUri is unavailable", async () => {
    const constants = await loadConstantsModule({
      constantsMock: {
        experienceUrl: "exp://192.168.1.20:19000",
        expoConfig: {
          extra: {},
        },
      },
      isDev: true,
    });

    expect(constants.baseUrl).toBe("http://192.168.1.20:4000");
    expect(constants.baseWebsocketsUrl).toBe("ws://192.168.1.20:4000/");
    expect(constants.baseTasksUrl).toBe("http://192.168.1.20:4000/tasks");
  });

  it("uses BASE_URL outside dev mode and allows user websocket debug flag", async () => {
    const constants = await loadConstantsModule({
      constantsMock: {
        expoConfig: {
          extra: {
            BASE_URL: "https://api.prod.com",
            WEBSOCKETS_DEBUG: "false",
          },
        },
      },
      isDev: false,
    });

    expect(constants.baseUrl).toBe("https://api.prod.com");
    expect(constants.baseWebsocketsUrl).toBe("https://ws.prod.com/");
    expect(constants.baseTasksUrl).toBe("https://tasks.prod.com/tasks");

    constants.logSocket({featureFlags: {debugWebsockets: {enabled: true}}}, "enabled");
    expect(console.debug).toHaveBeenCalledWith("[websocket]", "enabled");
  });

  it("falls back to non-dev hostUri when BASE_URL is missing", async () => {
    const constants = await loadConstantsModule({
      constantsMock: {
        expoConfig: {
          extra: {},
          hostUri: "172.16.0.3:8081",
        },
      },
      isDev: false,
    });

    expect(constants.baseUrl).toBe("http://172.16.0.3:4000");
    expect(constants.baseWebsocketsUrl).toBe("ws://172.16.0.3:4000/");
    expect(constants.baseTasksUrl).toBe("http://172.16.0.3:4000/tasks");
  });

  it("warns for exp.direct tunnels and falls back to localhost", async () => {
    const constants = await loadConstantsModule({
      constantsMock: {
        expoConfig: {
          extra: {},
        },
        expoGoConfig: {
          debuggerHost: "abc.exp.direct:80",
        },
      },
      isDev: false,
    });

    expect(console.error).toHaveBeenCalledWith(
      "Expo Tunnel is not currently supported for connecting to the API, please use LAN or Local mode."
    );
    expect(constants.baseUrl).toBe("http://localhost:4000");
    expect(constants.baseWebsocketsUrl).toBe("ws://localhost:4000/");
    expect(constants.baseTasksUrl).toBe("http://localhost:4000/tasks");
  });
});
