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

// When we use "expo publish", we want to point the API at the prod API. In the future,
// we'll want to point at the staging API, and probably have a development release channel.
if (Constants.expoGoConfig?.debuggerHost?.includes("exp.direct")) {
  console.error(
    "Expo Tunnel is not currently supported for connecting to the API, please use LAN or Local mode."
  );
}

export let baseUrl: string;
export let baseWebsocketsUrl: string;
export let baseTasksUrl: string;

const isDev = typeof __DEV__ !== "undefined" && __DEV__;

if (process.env.EXPO_PUBLIC_API_URL) {
  // Explicit override (e.g. .env)
  baseUrl = process.env.EXPO_PUBLIC_API_URL;
  baseWebsocketsUrl = `${baseUrl.replace("api.", "ws.")}/`;
  baseTasksUrl = `${baseUrl.replace("api.", "tasks.")}/tasks`;

  console.debug(
    `Base URL set to apiUrl ${baseUrl} for env ${
      Constants.expoConfig?.extra?.APP_ENV ?? "unknown"
    }, websocket to ${baseWebsocketsUrl}, tasks to ${baseTasksUrl}`
  );
} else if (isDev && Constants.expoConfig?.hostUri) {
  // Dev simulator/device
  baseUrl = `http://${Constants.expoConfig?.hostUri?.split(`:`).shift()?.concat(":4000")}`;
  baseWebsocketsUrl = `ws://${Constants.expoConfig?.hostUri?.split(`:`).shift()?.concat(":4000")}/`;
  baseTasksUrl = `http://${Constants.expoConfig?.hostUri?.split(`:`).shift()?.concat(":4000")}/tasks`;
  console.debug(
    `Base URL set to hostUri ${baseUrl}, websocket to ${baseWebsocketsUrl}`,
    Constants.expoConfig?.hostUri
  );
} else if (isDev && Constants.experienceUrl) {
  // Dev web (experienceUrl)
  baseUrl = `http:${Constants.experienceUrl?.split(`:`)[1]?.concat(":4000")}`;
  baseWebsocketsUrl = `ws:${Constants.experienceUrl?.split(`:`)[1]?.concat(":4000")}/`;
  baseTasksUrl = `http:${Constants.experienceUrl?.split(`:`)[1]?.concat(":4000")}/tasks`;
  console.debug(
    `Base URL set to experienceUrl ${baseUrl}, websocket to ${baseWebsocketsUrl}`,
    Constants.expoConfig?.hostUri
  );
} else if (isDev) {
  // Dev web fallback
  baseUrl = `http://localhost:4000`;
  baseWebsocketsUrl = `ws://localhost:4000/`;
  baseTasksUrl = `http://localhost:4000/tasks`;
  console.debug(`Base URL set to localhost ${baseUrl}, websocket to ${baseWebsocketsUrl}`);
} else if (Constants.expoConfig?.extra?.BASE_URL) {
  // Prod/staging
  baseUrl = Constants.expoConfig?.extra?.BASE_URL;
  baseWebsocketsUrl = `${baseUrl.replace("api.", "ws.")}/`;
  baseTasksUrl = `${baseUrl.replace("api.", "tasks.")}/tasks`;

  console.debug(
    `Base URL set to apiUrl ${baseUrl} for env ${
      Constants.expoConfig?.extra?.APP_ENV ?? "unknown"
    }, websocket to ${baseWebsocketsUrl}, tasks to ${baseTasksUrl}`
  );
} else if (Constants.expoConfig?.hostUri) {
  baseUrl = `http://${Constants.expoConfig?.hostUri?.split(`:`).shift()?.concat(":4000")}`;
  baseWebsocketsUrl = `ws://${Constants.expoConfig?.hostUri?.split(`:`).shift()?.concat(":4000")}/`;
  baseTasksUrl = `http://${Constants.expoConfig?.hostUri?.split(`:`).shift()?.concat(":4000")}/tasks`;
  console.debug(
    `Base URL set to hostUri ${baseUrl}, websocket to ${baseWebsocketsUrl}`,
    Constants.expoConfig?.hostUri
  );
} else if (Constants.experienceUrl) {
  baseUrl = `http:${Constants.experienceUrl?.split(`:`)[1]?.concat(":4000")}`;
  baseWebsocketsUrl = `ws:${Constants.experienceUrl?.split(`:`)[1]?.concat(":4000")}/`;
  baseTasksUrl = `http:${Constants.experienceUrl?.split(`:`)[1]?.concat(":4000")}/tasks`;
  console.debug(
    `Base URL set to experienceUrl ${baseUrl}, websocket to ${baseWebsocketsUrl}`,
    Constants.expoConfig?.hostUri
  );
} else {
  baseUrl = `http://localhost:4000`;
  baseWebsocketsUrl = `ws://localhost:4000/`;
  baseTasksUrl = `http://localhost:4000/tasks`;
  console.debug(`Base URL set to localhost ${baseUrl}, websocket to ${baseWebsocketsUrl}`);
}
