import Constants from "expo-constants";

// biome-ignore lint/suspicious/noExplicitAny: RootState is hard to type without becoming circular.
export type RootState = any;
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
// Can also be enabled by user feature flag.
const WEBSOCKETS_DEBUG = Constants.expoConfig?.extra?.WEBSOCKETS_DEBUG === "true";
if (WEBSOCKETS_DEBUG) {
  console.debug("WEBSOCKETS_DEBUG is enabled");
}

// Handy debug logging for websockets, enabled by user.featureFlags.debugWebsockets.enabled or passing in true.
export const logSocket = (
  user?: {featureFlags?: {debugWebsockets?: {enabled?: boolean}}} | boolean,
  ...args: string[]
): void => {
  if (
    typeof user === "boolean"
      ? user
      : user?.featureFlags?.debugWebsockets?.enabled || WEBSOCKETS_DEBUG
  ) {
    console.debug(`[websocket]`, ...args);
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

const LOCALHOST: BaseUrls = {
  baseTasksUrl: "http://localhost:4000/tasks",
  baseUrl: "http://localhost:4000",
  baseWebsocketsUrl: "ws://localhost:4000/",
};

/**
 * Pure resolver for the base URLs used throughout the RTK package.
 * Decoupled from the Expo-constants module so it can be unit tested.
 */
export const resolveBaseUrls = (args: {
  envApiUrl?: string;
  expoConstants: ExpoConstantsShape;
  isDev: boolean;
}): BaseUrls => {
  const hostUriPrefix = args.expoConstants.expoConfig?.hostUri?.split(":").shift();
  const experiencePrefix = args.expoConstants.experienceUrl?.split(":")[1];
  const baseFromExtra = args.expoConstants.expoConfig?.extra?.BASE_URL;
  const base = args.envApiUrl ?? (!args.isDev ? baseFromExtra : undefined);
  const host = args.isDev ? hostUriPrefix : !base ? hostUriPrefix : undefined;
  const experience = !base && !host ? experiencePrefix : undefined;
  if (base !== undefined)
    return {
      baseTasksUrl: `${base.replace("api.", "tasks.")}/tasks`,
      baseUrl: base,
      baseWebsocketsUrl: `${base.replace("api.", "ws.")}/`,
    };
  if (host !== undefined)
    return {
      baseTasksUrl: `http://${host}:4000/tasks`,
      baseUrl: `http://${host}:4000`,
      baseWebsocketsUrl: `ws://${host}:4000/`,
    };
  if (experience !== undefined)
    return {
      baseTasksUrl: `http:${experience}:4000/tasks`,
      baseUrl: `http:${experience}:4000`,
      baseWebsocketsUrl: `ws:${experience}:4000/`,
    };
  return LOCALHOST;
};

// When we use "expo publish", we want to point the API at the prod API. In the future,
// we'll want to point at the staging API, and probably have a development release channel.
if (Constants.expoGoConfig?.debuggerHost?.includes("exp.direct")) {
  console.error(
    "Expo Tunnel is not currently supported for connecting to the API, please use LAN or Local mode."
  );
}

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

const resolved = resolveBaseUrls({
  envApiUrl: process.env.EXPO_PUBLIC_API_URL,
  expoConstants: Constants as ExpoConstantsShape,
  isDev,
});

export const baseUrl = resolved.baseUrl;
export const baseWebsocketsUrl = resolved.baseWebsocketsUrl;
export const baseTasksUrl = resolved.baseTasksUrl;

console.debug(
  `Base URL set to ${baseUrl} for env ${
    Constants.expoConfig?.extra?.APP_ENV ?? "unknown"
  }, websocket to ${baseWebsocketsUrl}, tasks to ${baseTasksUrl}`
);
