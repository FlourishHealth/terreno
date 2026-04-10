import {afterEach, beforeEach, describe, expect, it, mock, spyOn} from "bun:test";

interface LoadConstantsParams {
  apiUrl?: string;
  debuggerHost?: string;
  experienceUrl?: string;
  extra?: Record<string, string>;
  hostUri?: string;
}

interface ConstantsModule {
  AUTH_DEBUG: boolean;
  baseTasksUrl: string;
  baseUrl: string;
  baseWebsocketsUrl: string;
  logAuth: (...args: string[]) => void;
  logSocket: (
    user?: {featureFlags?: {debugWebsockets?: {enabled?: boolean}}} | boolean,
    ...args: string[]
  ) => void;
}

const tunnelErrorMessage =
  "Expo Tunnel is not currently supported for connecting to the API, please use LAN or Local mode.";

let importCounter = 0;

const loadConstantsModule = async ({
  apiUrl,
  debuggerHost,
  experienceUrl,
  extra,
  hostUri,
}: LoadConstantsParams): Promise<ConstantsModule> => {
  if (apiUrl) {
    process.env.EXPO_PUBLIC_API_URL = apiUrl;
  } else {
    delete process.env.EXPO_PUBLIC_API_URL;
  }

  const expoConstants = (await import("expo-constants")).default as {
    experienceUrl?: string;
    expoConfig?: {extra?: Record<string, string>; hostUri?: string};
    expoGoConfig?: {debuggerHost?: string};
  };

  expoConstants.expoConfig = {extra: extra ?? {}};
  if (hostUri) {
    expoConstants.expoConfig.hostUri = hostUri;
  }

  if (experienceUrl) {
    expoConstants.experienceUrl = experienceUrl;
  } else {
    delete expoConstants.experienceUrl;
  }

  if (debuggerHost) {
    expoConstants.expoGoConfig = {debuggerHost};
  } else {
    delete expoConstants.expoGoConfig;
  }

  return (await import(`./constants?test=${importCounter++}`)) as ConstantsModule;
};

describe("constants", () => {
  const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
  let debugSpy: ReturnType<typeof spyOn>;
  let errorSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    debugSpy = spyOn(console, "debug").mockImplementation(mock(() => {}));
    errorSpy = spyOn(console, "error").mockImplementation(mock(() => {}));
  });

  afterEach(() => {
    debugSpy.mockRestore();
    errorSpy.mockRestore();
    if (originalApiUrl) {
      process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
    } else {
      delete process.env.EXPO_PUBLIC_API_URL;
    }
  });

  it("uses EXPO_PUBLIC_API_URL override when present", async () => {
    const constants = await loadConstantsModule({
      apiUrl: "https://api.example.com",
      extra: {APP_ENV: "production"},
    });

    expect(constants.baseUrl).toBe("https://api.example.com");
    expect(constants.baseWebsocketsUrl).toBe("https://ws.example.com/");
    expect(constants.baseTasksUrl).toBe("https://tasks.example.com/tasks");
  });

  it("uses BASE_URL from expo extra when no env override", async () => {
    const constants = await loadConstantsModule({
      extra: {APP_ENV: "staging", BASE_URL: "https://api.staging.example.com"},
    });

    expect(constants.baseUrl).toBe("https://api.staging.example.com");
    expect(constants.baseWebsocketsUrl).toBe("https://ws.staging.example.com/");
    expect(constants.baseTasksUrl).toBe("https://tasks.staging.example.com/tasks");
  });

  it("derives host-based URLs from expoConfig.hostUri", async () => {
    const constants = await loadConstantsModule({hostUri: "10.0.0.8:8081"});

    expect(constants.baseUrl).toBe("http://10.0.0.8:4000");
    expect(constants.baseWebsocketsUrl).toBe("ws://10.0.0.8:4000/");
    expect(constants.baseTasksUrl).toBe("http://10.0.0.8:4000/tasks");
  });

  it("derives experience URLs when hostUri is absent", async () => {
    const constants = await loadConstantsModule({experienceUrl: "exp://192.168.0.55:8081"});

    expect(constants.baseUrl).toBe("http://192.168.0.55:4000");
    expect(constants.baseWebsocketsUrl).toBe("ws://192.168.0.55:4000/");
    expect(constants.baseTasksUrl).toBe("http://192.168.0.55:4000/tasks");
  });

  it("falls back to localhost when no URL sources exist", async () => {
    const constants = await loadConstantsModule({});

    expect(constants.baseUrl).toBe("http://localhost:4000");
    expect(constants.baseWebsocketsUrl).toBe("ws://localhost:4000/");
    expect(constants.baseTasksUrl).toBe("http://localhost:4000/tasks");
  });

  it("logs auth debug messages only when AUTH_DEBUG is enabled", async () => {
    const enabledConstants = await loadConstantsModule({extra: {AUTH_DEBUG: "true"}});
    expect(enabledConstants.AUTH_DEBUG).toBe(true);
    expect(debugSpy).toHaveBeenCalledWith("AUTH_DEBUG is enabled");

    enabledConstants.logAuth("auth", "message");
    expect(debugSpy).toHaveBeenCalledWith("auth", "message");

    const disabledConstants = await loadConstantsModule({});
    const callCountBefore = debugSpy.mock.calls.length;
    disabledConstants.logAuth("hidden");
    expect(debugSpy.mock.calls.length).toBe(callCountBefore);
  });

  it("supports logSocket via explicit boolean or user feature flag", async () => {
    const constants = await loadConstantsModule({});

    const callCountBefore = debugSpy.mock.calls.length;
    constants.logSocket(false, "ignored");
    expect(debugSpy.mock.calls.length).toBe(callCountBefore);

    constants.logSocket(true, "forced");
    expect(debugSpy).toHaveBeenCalledWith("[websocket]", "forced");

    constants.logSocket({featureFlags: {debugWebsockets: {enabled: true}}}, "from-user");
    expect(debugSpy).toHaveBeenCalledWith("[websocket]", "from-user");
  });

  it("enables socket logging globally with WEBSOCKETS_DEBUG", async () => {
    const constants = await loadConstantsModule({extra: {WEBSOCKETS_DEBUG: "true"}});

    expect(debugSpy).toHaveBeenCalledWith("WEBSOCKETS_DEBUG is enabled");

    constants.logSocket(undefined, "global-enabled");
    expect(debugSpy).toHaveBeenCalledWith("[websocket]", "global-enabled");
  });

  it("warns when expo tunnel is detected", async () => {
    await loadConstantsModule({debuggerHost: "foo.exp.direct:19000"});
    expect(errorSpy).toHaveBeenCalledWith(tunnelErrorMessage);
  });
});
