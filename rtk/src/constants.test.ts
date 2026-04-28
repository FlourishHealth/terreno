import {afterEach, beforeEach, describe, expect, it} from "bun:test";

import {
  AUTH_DEBUG,
  baseTasksUrl,
  baseUrl,
  baseWebsocketsUrl,
  logAuth,
  logSocket,
  resolveBaseUrls,
} from "./constants";

describe("resolveBaseUrls", () => {
  it("treats an empty envApiUrl as unset and falls back to localhost", () => {
    const urls = resolveBaseUrls({
      envApiUrl: "",
      expoConstants: {expoConfig: {extra: {}}},
      isDev: false,
    });
    expect(urls.baseUrl).toBe("http://localhost:4000");
    expect(urls.baseWebsocketsUrl).toBe("ws://localhost:4000/");
    expect(urls.baseTasksUrl).toBe("http://localhost:4000/tasks");
  });

  it("treats an empty BASE_URL extra as unset and falls back to localhost in non-dev", () => {
    const urls = resolveBaseUrls({
      expoConstants: {expoConfig: {extra: {BASE_URL: ""}}},
      isDev: false,
    });
    expect(urls.baseUrl).toBe("http://localhost:4000");
  });

  it("uses env override when provided", () => {
    const urls = resolveBaseUrls({
      envApiUrl: "https://api.example.com",
      expoConstants: {expoConfig: {extra: {}}},
      isDev: false,
    });
    expect(urls.baseUrl).toBe("https://api.example.com");
    expect(urls.baseWebsocketsUrl).toBe("https://ws.example.com/");
    expect(urls.baseTasksUrl).toBe("https://tasks.example.com/tasks");
  });

  it("uses hostUri in dev mode", () => {
    const urls = resolveBaseUrls({
      expoConstants: {expoConfig: {extra: {}, hostUri: "10.0.0.12:8081"}},
      isDev: true,
    });
    expect(urls.baseUrl).toBe("http://10.0.0.12:4000");
    expect(urls.baseWebsocketsUrl).toBe("ws://10.0.0.12:4000/");
    expect(urls.baseTasksUrl).toBe("http://10.0.0.12:4000/tasks");
  });

  it("falls back to experienceUrl in dev mode when hostUri missing", () => {
    const urls = resolveBaseUrls({
      expoConstants: {
        experienceUrl: "exp://192.168.1.20:19000",
        expoConfig: {extra: {}},
      },
      isDev: true,
    });
    expect(urls.baseUrl).toBe("http://192.168.1.20:4000");
    expect(urls.baseWebsocketsUrl).toBe("ws://192.168.1.20:4000/");
    expect(urls.baseTasksUrl).toBe("http://192.168.1.20:4000/tasks");
  });

  it("falls back to localhost in dev mode when nothing else is available", () => {
    const urls = resolveBaseUrls({
      expoConstants: {expoConfig: {extra: {}}},
      isDev: true,
    });
    expect(urls.baseUrl).toBe("http://localhost:4000");
    expect(urls.baseWebsocketsUrl).toBe("ws://localhost:4000/");
    expect(urls.baseTasksUrl).toBe("http://localhost:4000/tasks");
  });

  it("uses BASE_URL from extra when not in dev mode", () => {
    const urls = resolveBaseUrls({
      expoConstants: {expoConfig: {extra: {BASE_URL: "https://api.prod.com"}}},
      isDev: false,
    });
    expect(urls.baseUrl).toBe("https://api.prod.com");
    expect(urls.baseWebsocketsUrl).toBe("https://ws.prod.com/");
    expect(urls.baseTasksUrl).toBe("https://tasks.prod.com/tasks");
  });

  it("falls back to hostUri when BASE_URL absent in non-dev", () => {
    const urls = resolveBaseUrls({
      expoConstants: {expoConfig: {extra: {}, hostUri: "172.16.0.3:8081"}},
      isDev: false,
    });
    expect(urls.baseUrl).toBe("http://172.16.0.3:4000");
    expect(urls.baseWebsocketsUrl).toBe("ws://172.16.0.3:4000/");
    expect(urls.baseTasksUrl).toBe("http://172.16.0.3:4000/tasks");
  });

  it("falls back to experienceUrl in non-dev when hostUri absent", () => {
    const urls = resolveBaseUrls({
      expoConstants: {
        experienceUrl: "exp://10.1.2.3:19000",
        expoConfig: {extra: {}},
      },
      isDev: false,
    });
    expect(urls.baseUrl).toBe("http://10.1.2.3:4000");
  });

  it("defaults to localhost in non-dev when nothing is configured", () => {
    const urls = resolveBaseUrls({
      expoConstants: {expoConfig: {extra: {}}},
      isDev: false,
    });
    expect(urls.baseUrl).toBe("http://localhost:4000");
  });
});

describe("module-level exports", () => {
  it("exports baseUrl / websockets / tasks URLs that resolve to localhost with default mocks", () => {
    expect(baseUrl).toBe("http://localhost:4000");
    expect(baseWebsocketsUrl).toBe("ws://localhost:4000/");
    expect(baseTasksUrl).toBe("http://localhost:4000/tasks");
  });

  it("AUTH_DEBUG is false by default with test-preload mocks", () => {
    expect(AUTH_DEBUG).toBe(false);
  });
});

describe("logAuth / logSocket", () => {
  const originalDebug = console.debug;
  const calls: unknown[][] = [];

  beforeEach(() => {
    calls.length = 0;
    console.debug = (...args: unknown[]): void => {
      calls.push(args);
    };
  });

  afterEach(() => {
    console.debug = originalDebug;
  });

  it("logAuth is a no-op when AUTH_DEBUG is disabled", () => {
    logAuth("auth message");
    expect(calls).toEqual([]);
  });

  it("logSocket logs when passed boolean true", () => {
    logSocket(true, "socket message");
    expect(calls).toEqual([["[websocket]", "socket message"]]);
  });

  it("logSocket does not log when passed boolean false", () => {
    logSocket(false, "suppressed");
    expect(calls).toEqual([]);
  });

  it("logSocket logs when user has debugWebsockets feature flag enabled", () => {
    logSocket({featureFlags: {debugWebsockets: {enabled: true}}}, "enabled");
    expect(calls).toEqual([["[websocket]", "enabled"]]);
  });

  it("logSocket does not log when user has debugWebsockets disabled", () => {
    logSocket({featureFlags: {debugWebsockets: {enabled: false}}}, "disabled");
    expect(calls).toEqual([]);
  });

  it("logSocket does not log with undefined user", () => {
    logSocket(undefined, "no user");
    expect(calls).toEqual([]);
  });
});

// Mock.module tests (expo tunnel warning, AUTH_DEBUG) moved to
// src/isolated/constants.isolated.ts to avoid coverage tracking interference.
