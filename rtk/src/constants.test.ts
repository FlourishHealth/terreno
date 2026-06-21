import {afterEach, beforeEach, describe, expect, it} from "bun:test";

import {
  AUTH_DEBUG,
  baseTasksUrl,
  baseUrl,
  baseWebsocketsUrl,
  isWebsocketsDebugEnabled,
  logAuth,
  logSocket,
  resolveBaseUrls,
  SAME_ORIGIN_SENTINEL,
  setRealtimeDebug,
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

  it("envApiUrl takes priority over BASE_URL in non-dev", () => {
    const urls = resolveBaseUrls({
      envApiUrl: "https://api.override.com",
      expoConstants: {expoConfig: {extra: {BASE_URL: "https://api.from-extra.com"}}},
      isDev: false,
    });
    expect(urls.baseUrl).toBe("https://api.override.com");
  });

  it("envApiUrl takes priority over hostUri in dev mode", () => {
    const urls = resolveBaseUrls({
      envApiUrl: "https://api.override.com",
      expoConstants: {expoConfig: {extra: {}, hostUri: "10.0.0.5:8081"}},
      isDev: true,
    });
    expect(urls.baseUrl).toBe("https://api.override.com");
    expect(urls.baseWebsocketsUrl).toBe("https://ws.override.com/");
    expect(urls.baseTasksUrl).toBe("https://tasks.override.com/tasks");
  });

  it("falls back to localhost when expoConfig is undefined", () => {
    const urls = resolveBaseUrls({
      expoConstants: {},
      isDev: false,
    });
    expect(urls.baseUrl).toBe("http://localhost:4000");
  });

  it("ignores BASE_URL from extra in dev mode and uses hostUri instead", () => {
    const urls = resolveBaseUrls({
      expoConstants: {
        expoConfig: {extra: {BASE_URL: "https://api.prod.com"}, hostUri: "192.168.0.10:8081"},
      },
      isDev: true,
    });
    expect(urls.baseUrl).toBe("http://192.168.0.10:4000");
    expect(urls.baseWebsocketsUrl).toBe("ws://192.168.0.10:4000/");
    expect(urls.baseTasksUrl).toBe("http://192.168.0.10:4000/tasks");
  });

  it("falls back to experienceUrl when hostUri is empty string", () => {
    const urls = resolveBaseUrls({
      expoConstants: {
        experienceUrl: "exp://10.0.0.5:19000",
        expoConfig: {extra: {}, hostUri: ""},
      },
      isDev: true,
    });
    expect(urls.baseUrl).toBe("http://10.0.0.5:4000");
  });

  it("replaces 'api.' subdomain with 'tasks.' and 'ws.' for envApiUrl", () => {
    const urls = resolveBaseUrls({
      envApiUrl: "https://api.staging.example.io",
      expoConstants: {expoConfig: {extra: {}}},
      isDev: false,
    });
    expect(urls.baseUrl).toBe("https://api.staging.example.io");
    expect(urls.baseWebsocketsUrl).toBe("https://ws.staging.example.io/");
    expect(urls.baseTasksUrl).toBe("https://tasks.staging.example.io/tasks");
  });

  it("handles envApiUrl without 'api.' subdomain gracefully", () => {
    const urls = resolveBaseUrls({
      envApiUrl: "https://backend.example.com",
      expoConstants: {expoConfig: {extra: {}}},
      isDev: false,
    });
    expect(urls.baseUrl).toBe("https://backend.example.com");
    expect(urls.baseWebsocketsUrl).toBe("https://backend.example.com/");
    expect(urls.baseTasksUrl).toBe("https://backend.example.com/tasks");
  });

  it("resolves the same-origin sentinel to the window origin (https -> wss)", () => {
    const urls = resolveBaseUrls({
      expoConstants: {expoConfig: {extra: {BASE_URL: SAME_ORIGIN_SENTINEL}}},
      isDev: false,
      windowOrigin: "https://api.example.com",
    });
    expect(urls.baseUrl).toBe("https://api.example.com");
    expect(urls.baseWebsocketsUrl).toBe("wss://api.example.com/");
    expect(urls.baseTasksUrl).toBe("https://api.example.com/tasks");
  });

  it("resolves the same-origin sentinel to the window origin (http -> ws)", () => {
    const urls = resolveBaseUrls({
      expoConstants: {expoConfig: {extra: {BASE_URL: SAME_ORIGIN_SENTINEL}}},
      isDev: false,
      windowOrigin: "http://localhost:4000",
    });
    expect(urls.baseUrl).toBe("http://localhost:4000");
    expect(urls.baseWebsocketsUrl).toBe("ws://localhost:4000/");
    expect(urls.baseTasksUrl).toBe("http://localhost:4000/tasks");
  });

  it("resolves the same-origin sentinel even in dev mode when a window origin exists", () => {
    const urls = resolveBaseUrls({
      expoConstants: {
        expoConfig: {extra: {BASE_URL: SAME_ORIGIN_SENTINEL}, hostUri: "10.0.0.5:8081"},
      },
      isDev: true,
      windowOrigin: "https://admin.example.com",
    });
    expect(urls.baseUrl).toBe("https://admin.example.com");
    expect(urls.baseWebsocketsUrl).toBe("wss://admin.example.com/");
  });

  it("falls back to existing resolution when the sentinel is set but no window origin", () => {
    const urls = resolveBaseUrls({
      expoConstants: {expoConfig: {extra: {BASE_URL: SAME_ORIGIN_SENTINEL}}},
      isDev: false,
    });
    expect(urls.baseUrl).toBe("http://localhost:4000");
    expect(urls.baseWebsocketsUrl).toBe("ws://localhost:4000/");
  });

  it("does not treat the sentinel as a literal base URL when a window origin is absent", () => {
    const urls = resolveBaseUrls({
      expoConstants: {
        expoConfig: {extra: {BASE_URL: SAME_ORIGIN_SENTINEL}, hostUri: "172.16.0.3:8081"},
      },
      isDev: false,
    });
    // Sentinel ignored -> falls through to hostUri resolution, not the literal "__SAME_ORIGIN__".
    expect(urls.baseUrl).toBe("http://172.16.0.3:4000");
  });

  it("leaves a non-sentinel BASE_URL unchanged when a window origin is present", () => {
    const urls = resolveBaseUrls({
      expoConstants: {expoConfig: {extra: {BASE_URL: "https://api.prod.com"}}},
      isDev: false,
      windowOrigin: "https://some-other-origin.com",
    });
    expect(urls.baseUrl).toBe("https://api.prod.com");
    expect(urls.baseWebsocketsUrl).toBe("https://ws.prod.com/");
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

describe("logAuth", () => {
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
});

describe("logSocket", () => {
  const originalInfo = console.info;
  const calls: unknown[][] = [];

  beforeEach(() => {
    calls.length = 0;
    console.info = (...args: unknown[]): void => {
      calls.push(args);
    };
  });

  afterEach(() => {
    console.info = originalInfo;
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

describe("setRealtimeDebug / isWebsocketsDebugEnabled", () => {
  const originalInfo = console.info;
  afterEach(() => {
    console.info = originalInfo;
    setRealtimeDebug(false);
  });

  it("isWebsocketsDebugEnabled returns false by default", () => {
    expect(isWebsocketsDebugEnabled()).toBe(false);
  });

  it("setRealtimeDebug(true) makes isWebsocketsDebugEnabled return true", () => {
    setRealtimeDebug(true);
    expect(isWebsocketsDebugEnabled()).toBe(true);
  });

  it("setRealtimeDebug(false) disables runtime debug", () => {
    setRealtimeDebug(true);
    expect(isWebsocketsDebugEnabled()).toBe(true);
    setRealtimeDebug(false);
    expect(isWebsocketsDebugEnabled()).toBe(false);
  });

  it("logSocket logs when runtime websocket debug is enabled via setRealtimeDebug", () => {
    const calls: unknown[][] = [];
    console.info = (...args: unknown[]): void => {
      calls.push(args);
    };

    setRealtimeDebug(true);
    logSocket(undefined, "runtime debug message");
    expect(calls).toEqual([["[websocket]", "runtime debug message"]]);
  });
});

describe("logSocket edge cases", () => {
  const originalInfo = console.info;
  const calls: unknown[][] = [];

  beforeEach(() => {
    calls.length = 0;
    console.info = (...args: unknown[]): void => {
      calls.push(args);
    };
  });

  afterEach(() => {
    console.info = originalInfo;
    setRealtimeDebug(false);
  });

  it("logSocket does not log when user object has no featureFlags", () => {
    logSocket({}, "no flags");
    expect(calls).toEqual([]);
  });

  it("logSocket does not log when featureFlags exists but debugWebsockets is missing", () => {
    logSocket({featureFlags: {}}, "missing debugWebsockets");
    expect(calls).toEqual([]);
  });

  it("logSocket does not log when debugWebsockets exists but enabled is undefined", () => {
    logSocket({featureFlags: {debugWebsockets: {}}}, "undefined enabled");
    expect(calls).toEqual([]);
  });

  it("logSocket logs multiple args when runtime debug is enabled", () => {
    setRealtimeDebug(true);
    logSocket(undefined, "arg1", "arg2", "arg3");
    expect(calls).toEqual([["[websocket]", "arg1", "arg2", "arg3"]]);
  });

  it("logSocket prefers user boolean over runtime debug setting", () => {
    setRealtimeDebug(true);
    logSocket(false, "should not log");
    expect(calls).toEqual([]);
  });
});

describe("SAME_ORIGIN_SENTINEL", () => {
  it("is the literal string __SAME_ORIGIN__", () => {
    expect(SAME_ORIGIN_SENTINEL).toBe("__SAME_ORIGIN__");
  });
});

// Mock.module tests (expo tunnel warning, AUTH_DEBUG) moved to
// src/isolated/constants.isolated.ts to avoid coverage tracking interference.

describe("logSocket with runtime debug via setRealtimeDebug", () => {
  const originalInfo = console.info;
  const calls: unknown[][] = [];

  beforeEach(() => {
    calls.length = 0;
    console.info = (...args: unknown[]): void => {
      calls.push(args);
    };
  });

  afterEach(() => {
    console.info = originalInfo;
    setRealtimeDebug(false);
  });

  it("logSocket logs with user object when runtime debug is enabled", () => {
    setRealtimeDebug(true);
    logSocket({featureFlags: {debugWebsockets: {enabled: false}}}, "via runtime");
    expect(calls).toEqual([["[websocket]", "via runtime"]]);
  });

  it("logSocket does not log when user featureFlags is undefined and runtime debug is off", () => {
    logSocket({}, "no flags");
    expect(calls).toEqual([]);
  });

  it("logSocket does not log with user featureFlags.debugWebsockets undefined", () => {
    logSocket({featureFlags: {}}, "no ws");
    expect(calls).toEqual([]);
  });
});
