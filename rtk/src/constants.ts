import Constants from "expo-constants";

export interface RootState {
  auth?: {
    isAuthenticating?: boolean;
    lastTokenRefreshTimestamp: number | null;
    userId?: string;
  };
}
export const LOGOUT_ACTION_TYPE = "auth/logout";
export const TOKEN_REFRESHED_SUCCESS = "auth/tokenRefreshedSuccess";

export const AUTH_DEBUG = Constants.expoConfig?.extra?.AUTH_DEBUG === "true";
if (AUTH_DEBUG) {
  console.debug("AUTH_DEBUG is enabled");
}

export const logAuth = (...args: string[]): void => {
  if (AUTH_DEBUG) {
    console.debug(...args);
  }
};

// Handy debug logging socket events, but not enabled by default.
// Can also be enabled by user feature flag or runtime via setRealtimeDebug (admin config).
const WEBSOCKETS_DEBUG = Constants.expoConfig?.extra?.WEBSOCKETS_DEBUG === "true";
if (WEBSOCKETS_DEBUG) {
  console.debug("WEBSOCKETS_DEBUG is enabled");
}

let runtimeWebsocketsDebug = false;

/** Enable websocket debug logging at runtime (e.g. from admin debug.websocketsDebug). */
export const setRealtimeDebug = (enabled: boolean): void => {
  runtimeWebsocketsDebug = enabled;
};

export const isWebsocketsDebugEnabled = (): boolean => {
  return WEBSOCKETS_DEBUG || runtimeWebsocketsDebug;
};

// Handy debug logging for websockets, enabled by user.featureFlags.debugWebsockets.enabled or passing in true.
export const logSocket = (
  user?: {featureFlags?: {debugWebsockets?: {enabled?: boolean}}} | boolean,
  ...args: string[]
): void => {
  if (
    typeof user === "boolean"
      ? user
      : user?.featureFlags?.debugWebsockets?.enabled || isWebsocketsDebugEnabled()
  ) {
    console.info("[websocket]", ...args);
  }
};

export interface ExpoConstantsShape {
  experienceUrl?: string;
  expoConfig?: {
    extra?: Record<string, string | undefined>;
    hostUri?: string;
  };
  expoGoConfig?: {
    debuggerHost?: string;
  };
}

export interface BaseUrls {
  baseUrl: string;
  baseWebsocketsUrl: string;
  baseTasksUrl: string;
}

/**
 * Sentinel value for `BASE_URL`. When set in `app.json` `extra.BASE_URL`, the
 * base URL resolves to the runtime page origin (`window.location.origin`).
 * Used by same-origin deployments such as the standalone admin SPA.
 */
export const SAME_ORIGIN_SENTINEL = "__SAME_ORIGIN__";

/**
 * Default local API port used when resolving dev base URLs from the Expo
 * host/experience URL or the localhost fallback. Matches the example backend.
 */
export const DEFAULT_DEV_API_PORT = 4000;

/**
 * Resolves the local dev API port. Apps whose backend listens on a non-default
 * port (for example 3000 or 9000) override it via the `EXPO_PUBLIC_DEV_API_PORT`
 * env var or `expoConfig.extra.DEV_API_PORT`, mirroring how `EXPO_PUBLIC_API_URL`
 * and `extra.BASE_URL` are provided. Missing or invalid values fall back to the
 * default port.
 */
export const resolveDevApiPort = (args: {
  envDevApiPort?: string;
  expoConstants: ExpoConstantsShape;
}): number => {
  const raw = args.envDevApiPort ?? args.expoConstants.expoConfig?.extra?.DEV_API_PORT;
  if (raw === undefined || raw === "") {
    return DEFAULT_DEV_API_PORT;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_DEV_API_PORT;
  }
  return parsed;
};

const localhostUrls = (port: number): BaseUrls => ({
  baseTasksUrl: `http://localhost:${port}/tasks`,
  baseUrl: `http://localhost:${port}`,
  baseWebsocketsUrl: `ws://localhost:${port}/`,
});

/**
 * Pure resolver for the base URLs used throughout the RTK package.
 * Decoupled from the Expo-constants module so it can be unit tested.
 */
export const resolveBaseUrls = (args: {
  // Local dev API port for host/experience/localhost resolution. Defaults to
  // DEFAULT_DEV_API_PORT; callers pass the app-configured port (see resolveDevApiPort).
  devApiPort?: number;
  envApiUrl?: string;
  expoConstants: ExpoConstantsShape;
  isDev: boolean;
  // Defaults to globalThis.location.origin at the module-level call site.
  // Injectable so the sentinel resolution can be unit tested without a DOM.
  windowOrigin?: string;
}): BaseUrls => {
  const port = args.devApiPort ?? DEFAULT_DEV_API_PORT;
  const hostUriPrefix = args.expoConstants.expoConfig?.hostUri?.split(":").shift();
  const experiencePrefix = args.expoConstants.experienceUrl?.split(":")[1];
  const baseFromExtra = args.expoConstants.expoConfig?.extra?.BASE_URL;

  // Same-origin sentinel: resolves to the page origin at runtime, regardless of
  // isDev. This check must run before the isDev branching below, otherwise the
  // sentinel would be silently dead in dev mode (which gates baseFromExtra).
  if (baseFromExtra === SAME_ORIGIN_SENTINEL && args.windowOrigin) {
    const origin = args.windowOrigin;
    return {
      baseTasksUrl: `${origin}/tasks`,
      baseUrl: origin,
      baseWebsocketsUrl: `${origin.replace(/^http/, "ws")}/`,
    };
  }
  // Never treat the sentinel as a literal base URL in the fallback path.
  const resolvedBaseFromExtra = baseFromExtra === SAME_ORIGIN_SENTINEL ? undefined : baseFromExtra;
  const base = args.envApiUrl || (!args.isDev ? resolvedBaseFromExtra : undefined);
  const host = args.isDev ? hostUriPrefix : !base ? hostUriPrefix : undefined;
  const experience = !base && !host ? experiencePrefix : undefined;
  if (base)
    return {
      baseTasksUrl: `${base.replace("api.", "tasks.")}/tasks`,
      baseUrl: base,
      baseWebsocketsUrl: `${base.replace("api.", "ws.")}/`,
    };
  if (host)
    return {
      baseTasksUrl: `http://${host}:${port}/tasks`,
      baseUrl: `http://${host}:${port}`,
      baseWebsocketsUrl: `ws://${host}:${port}/`,
    };
  if (experience)
    return {
      baseTasksUrl: `http:${experience}:${port}/tasks`,
      baseUrl: `http:${experience}:${port}`,
      baseWebsocketsUrl: `ws:${experience}:${port}/`,
    };
  return localhostUrls(port);
};

// When we use "expo publish", we want to point the API at the prod API. In the future,
// we'll want to point at the staging API, and probably have a development release channel.
if (Constants.expoGoConfig?.debuggerHost?.includes("exp.direct")) {
  console.error(
    "Expo Tunnel is not currently supported for connecting to the API, please use LAN or Local mode."
  );
}

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

const windowOrigin =
  typeof globalThis !== "undefined" &&
  (globalThis as {location?: {origin?: string}}).location?.origin
    ? (globalThis as {location?: {origin?: string}}).location?.origin
    : undefined;

const resolved = resolveBaseUrls({
  devApiPort: resolveDevApiPort({
    envDevApiPort: process.env.EXPO_PUBLIC_DEV_API_PORT,
    expoConstants: Constants as ExpoConstantsShape,
  }),
  envApiUrl: process.env.EXPO_PUBLIC_API_URL,
  expoConstants: Constants as ExpoConstantsShape,
  isDev,
  windowOrigin,
});

export const baseUrl = resolved.baseUrl;
export const baseWebsocketsUrl = resolved.baseWebsocketsUrl;
export const baseTasksUrl = resolved.baseTasksUrl;

console.debug(
  `Base URL set to ${baseUrl} for env ${
    Constants.expoConfig?.extra?.APP_ENV ?? "unknown"
  }, websocket to ${baseWebsocketsUrl}, tasks to ${baseTasksUrl}`
);
