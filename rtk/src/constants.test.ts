import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";

import {
  hasUnsupportedExpoTunnel,
  isDebugEnabled,
  logAuthDebugEnabled,
  logAuthWithDebug,
  logResolvedBaseUrls,
  logWebsocketsDebugEnabled,
  resolveBaseUrls,
  shouldLogSocket,
  warnUnsupportedExpoTunnel,
} from "./constants";

describe("constants", () => {
  const originalConsoleDebug = console.debug;
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.debug = mock(() => {});
    console.error = mock(() => {});
  });

  afterEach(() => {
    console.debug = originalConsoleDebug;
    console.error = originalConsoleError;
  });

  describe("URL resolution", () => {
    it("uses EXPO_PUBLIC_API_URL when provided", () => {
      const resolved = resolveBaseUrls({
        apiUrl: "https://api.example.com",
        isDev: true,
      });

      expect(resolved.baseUrl).toBe("https://api.example.com");
      expect(resolved.baseWebsocketsUrl).toBe("https://ws.example.com/");
      expect(resolved.baseTasksUrl).toBe("https://tasks.example.com/tasks");
    });

    it("uses hostUri in dev mode", () => {
      const resolved = resolveBaseUrls({
        hostUri: "192.168.1.40:8081",
        isDev: true,
      });

      expect(resolved.baseUrl).toBe("http://192.168.1.40:4000");
      expect(resolved.baseWebsocketsUrl).toBe("ws://192.168.1.40:4000/");
      expect(resolved.baseTasksUrl).toBe("http://192.168.1.40:4000/tasks");
    });

    it("uses experienceUrl in dev mode when hostUri is missing", () => {
      const resolved = resolveBaseUrls({
        experienceUrl: "exp://10.10.0.5:8081",
        isDev: true,
      });

      expect(resolved.baseUrl).toBe("http://10.10.0.5:4000");
      expect(resolved.baseWebsocketsUrl).toBe("ws://10.10.0.5:4000/");
      expect(resolved.baseTasksUrl).toBe("http://10.10.0.5:4000/tasks");
    });

    it("falls back to localhost in dev mode", () => {
      const resolved = resolveBaseUrls({isDev: true});

      expect(resolved.baseUrl).toBe("http://localhost:4000");
      expect(resolved.baseWebsocketsUrl).toBe("ws://localhost:4000/");
      expect(resolved.baseTasksUrl).toBe("http://localhost:4000/tasks");
    });

    it("uses BASE_URL outside dev mode", () => {
      const resolved = resolveBaseUrls({
        baseUrlOverride: "https://api.prod.example.com",
        isDev: false,
      });

      expect(resolved.baseUrl).toBe("https://api.prod.example.com");
      expect(resolved.baseWebsocketsUrl).toBe("https://ws.prod.example.com/");
      expect(resolved.baseTasksUrl).toBe("https://tasks.prod.example.com/tasks");
    });

    it("uses hostUri outside dev mode when BASE_URL is missing", () => {
      const resolved = resolveBaseUrls({
        hostUri: "10.0.0.7:8081",
        isDev: false,
      });

      expect(resolved.baseUrl).toBe("http://10.0.0.7:4000");
      expect(resolved.baseWebsocketsUrl).toBe("ws://10.0.0.7:4000/");
      expect(resolved.baseTasksUrl).toBe("http://10.0.0.7:4000/tasks");
    });

    it("uses experienceUrl outside dev mode when hostUri is missing", () => {
      const resolved = resolveBaseUrls({
        experienceUrl: "exp://10.0.0.8:8081",
        isDev: false,
      });

      expect(resolved.baseUrl).toBe("http://10.0.0.8:4000");
      expect(resolved.baseWebsocketsUrl).toBe("ws://10.0.0.8:4000/");
      expect(resolved.baseTasksUrl).toBe("http://10.0.0.8:4000/tasks");
    });

    it("falls back to localhost outside dev mode", () => {
      const resolved = resolveBaseUrls({isDev: false});

      expect(resolved.baseUrl).toBe("http://localhost:4000");
      expect(resolved.baseWebsocketsUrl).toBe("ws://localhost:4000/");
      expect(resolved.baseTasksUrl).toBe("http://localhost:4000/tasks");
    });
  });

  describe("debug logging behavior", () => {
    it("logs auth debug enabled message when enabled", () => {
      logAuthDebugEnabled(true);
      expect(console.debug).toHaveBeenCalledWith("AUTH_DEBUG is enabled");
    });

    it("does not log auth debug enabled message when disabled", () => {
      logAuthDebugEnabled(false);
      expect(console.debug).not.toHaveBeenCalledWith("AUTH_DEBUG is enabled");
    });

    it("logs websocket debug enabled message when enabled", () => {
      logWebsocketsDebugEnabled(true);
      expect(console.debug).toHaveBeenCalledWith("WEBSOCKETS_DEBUG is enabled");
    });

    it("does not log websocket debug enabled message when disabled", () => {
      logWebsocketsDebugEnabled(false);
      expect(console.debug).not.toHaveBeenCalledWith("WEBSOCKETS_DEBUG is enabled");
    });

    it("logs auth messages when auth debug is enabled", () => {
      logAuthWithDebug(true, "auth-message");
      expect(console.debug).toHaveBeenCalledWith("auth-message");
    });

    it("does not log auth messages when auth debug is disabled", () => {
      logAuthWithDebug(false, "auth-message");
      expect(console.debug).not.toHaveBeenCalledWith("auth-message");
    });

    it("detects auth debug flag values", () => {
      expect(isDebugEnabled("true")).toBe(true);
      expect(isDebugEnabled("false")).toBe(false);
      expect(isDebugEnabled(undefined)).toBe(false);
    });

    it("enables websocket logging through all supported triggers", () => {
      expect(shouldLogSocket(undefined, true)).toBe(true);
      expect(shouldLogSocket(true, false)).toBe(true);
      expect(shouldLogSocket({featureFlags: {debugWebsockets: {enabled: true}}}, false)).toBe(true);
    });

    it("does not enable websocket logging for falsey triggers", () => {
      expect(shouldLogSocket(undefined, false)).toBe(false);
      expect(shouldLogSocket(false, true)).toBe(false);
      expect(shouldLogSocket({featureFlags: {debugWebsockets: {enabled: false}}}, false)).toBe(
        false
      );
    });
  });

  it("detects unsupported expo tunnel hosts", () => {
    expect(hasUnsupportedExpoTunnel("abc.exp.direct:19000")).toBe(true);
    expect(hasUnsupportedExpoTunnel("localhost:19000")).toBe(false);
    expect(hasUnsupportedExpoTunnel(undefined)).toBe(false);
  });

  it("emits unsupported tunnel warning only when needed", () => {
    warnUnsupportedExpoTunnel("abc.exp.direct:19000");
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenNthCalledWith(
      1,
      "Expo Tunnel is not currently supported for connecting to the API, please use LAN or Local mode."
    );

    warnUnsupportedExpoTunnel("localhost:19000");
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("emits resolved base URL logs with and without context", () => {
    logResolvedBaseUrls({
      baseTasksUrl: "http://localhost:4000/tasks",
      baseUrl: "http://localhost:4000",
      baseWebsocketsUrl: "ws://localhost:4000/",
      debugMessage: "no-context",
    });
    expect(console.debug).toHaveBeenCalledWith("no-context");

    logResolvedBaseUrls({
      baseTasksUrl: "http://localhost:4000/tasks",
      baseUrl: "http://localhost:4000",
      baseWebsocketsUrl: "ws://localhost:4000/",
      debugContext: "hostUri-value",
      debugMessage: "with-context",
    });
    expect(console.debug).toHaveBeenCalledWith("with-context", "hostUri-value");
  });
});
