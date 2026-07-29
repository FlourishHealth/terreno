/**
 * In-process isolated coverage for constants.ts module-load debug paths.
 *
 * The base test suite loads constants.ts once with debug flags disabled, so the
 * enable-time branches (AUTH_DEBUG / WEBSOCKETS_DEBUG log lines and the Expo
 * tunnel warning) never execute under coverage. Here we re-mock expo-constants
 * with every flag enabled and re-import the module through a cache-busting query
 * so its top-level runs again while coverage instrumentation is active.
 */
import {beforeEach, describe, it, mock} from "bun:test";
import {assert} from "chai";

interface ConstantsModule {
  AUTH_DEBUG: boolean;
  logAuth: (...args: string[]) => void;
  logSocket: (
    user?: {featureFlags?: {debugWebsockets?: {enabled?: boolean}}} | boolean,
    ...args: string[]
  ) => void;
  isWebsocketsDebugEnabled: () => boolean;
}

const loadWithEnabledFlags = async (): Promise<{
  module: ConstantsModule;
  debugCalls: unknown[][];
  errorCalls: unknown[][];
  infoCalls: unknown[][];
}> => {
  mock.module("expo-constants", () => ({
    default: {
      expoConfig: {extra: {AUTH_DEBUG: "true", WEBSOCKETS_DEBUG: "true"}},
      expoGoConfig: {debuggerHost: "abc.exp.direct"},
    },
  }));

  const debugCalls: unknown[][] = [];
  const errorCalls: unknown[][] = [];
  const infoCalls: unknown[][] = [];
  const originalDebug = console.debug;
  const originalError = console.error;
  const originalInfo = console.info;
  console.debug = (...args: unknown[]): void => {
    debugCalls.push(args);
  };
  console.error = (...args: unknown[]): void => {
    errorCalls.push(args);
  };
  console.info = (...args: unknown[]): void => {
    infoCalls.push(args);
  };

  try {
    const constantsUrl = new URL("../constants.ts", import.meta.url).href;
    const module = (await import(`${constantsUrl}?enabledFlags`)) as ConstantsModule;
    return {debugCalls, errorCalls, infoCalls, module};
  } finally {
    console.debug = originalDebug;
    console.error = originalError;
    console.info = originalInfo;
  }
};

describe("constants module-load debug paths", () => {
  beforeEach(() => {
    mock.restore();
  });

  it("logs debug lines and the tunnel warning when every flag is enabled", async () => {
    const {module, debugCalls, errorCalls} = await loadWithEnabledFlags();

    assert.isTrue(module.AUTH_DEBUG);
    assert.isTrue(module.isWebsocketsDebugEnabled());
    assert.isTrue(
      debugCalls.some((args) =>
        args.some((value) => String(value).includes("AUTH_DEBUG is enabled"))
      )
    );
    assert.isTrue(
      debugCalls.some((args) =>
        args.some((value) => String(value).includes("WEBSOCKETS_DEBUG is enabled"))
      )
    );
    assert.isTrue(
      errorCalls.some((args) =>
        args.some((value) => String(value).includes("Expo Tunnel is not currently"))
      )
    );
  });

  it("routes logAuth and logSocket through console when flags are enabled", async () => {
    const {module} = await loadWithEnabledFlags();

    const debugCalls: unknown[][] = [];
    const infoCalls: unknown[][] = [];
    const originalDebug = console.debug;
    const originalInfo = console.info;
    console.debug = (...args: unknown[]): void => {
      debugCalls.push(args);
    };
    console.info = (...args: unknown[]): void => {
      infoCalls.push(args);
    };
    try {
      module.logAuth("auth message");
      module.logSocket(undefined, "socket message");
    } finally {
      console.debug = originalDebug;
      console.info = originalInfo;
    }

    assert.isTrue(
      debugCalls.some((args) => args.some((value) => String(value).includes("auth message")))
    );
    assert.isTrue(
      infoCalls.some((args) => args[0] === "[websocket]" && args[1] === "socket message")
    );
  });
});
