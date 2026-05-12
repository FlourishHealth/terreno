/**
 * Isolated tests for constants.ts paths that require mock.module.
 *
 * These live in isolated/ so that mock.module calls do not interfere
 * with coverage tracking in the main constants.test.ts file.
 */
import {describe, expect, it, mock} from "bun:test";

describe("expo tunnel warning", () => {
  it("warns when expoGoConfig.debuggerHost contains exp.direct", async () => {
    const errorCalls: unknown[][] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]): void => {
      errorCalls.push(args);
    };
    mock.module("expo-constants", () => ({
      default: {
        expoConfig: {extra: {}},
        expoGoConfig: {debuggerHost: "abc.exp.direct"},
      },
    }));
    try {
      const testId = `${Date.now()}-${Math.random()}`;
      await import(`../constants?case=${testId}`);
      const warning = errorCalls.find((args) =>
        args.some((v) => typeof v === "string" && v.includes("Expo Tunnel is not currently"))
      );
      expect(warning).toBeDefined();
    } finally {
      console.error = originalError;
      mock.module("expo-constants", () => ({default: {expoConfig: {extra: {}}}}));
    }
  });
});

describe("AUTH_DEBUG enabled path", () => {
  it("logs debug messages from logAuth when AUTH_DEBUG is true on module load", async () => {
    const debugCalls: unknown[][] = [];
    const originalDebug = console.debug;
    console.debug = (...args: unknown[]): void => {
      debugCalls.push(args);
    };
    mock.module("expo-constants", () => ({
      default: {expoConfig: {extra: {AUTH_DEBUG: "true", WEBSOCKETS_DEBUG: "true"}}},
    }));
    try {
      const testId = `${Date.now()}-${Math.random()}`;
      const loaded = (await import(`../constants?case=${testId}`)) as typeof import("../constants");
      expect(loaded.AUTH_DEBUG).toBe(true);
      const preLength = debugCalls.length;
      loaded.logAuth("hello");
      expect(debugCalls.length).toBe(preLength + 1);
      loaded.logSocket(undefined, "ws on");
      expect(debugCalls.some((args) => args[0] === "[websocket]" && args[1] === "ws on")).toBe(
        true
      );
    } finally {
      console.debug = originalDebug;
      mock.module("expo-constants", () => ({default: {expoConfig: {extra: {}}}}));
    }
  });
});
