import Constants from "expo-constants";

// biome-ignore lint/suspicious/noExplicitAny: RootState is hard to type without becoming circular.
export type RootState = any;
export const LOGOUT_ACTION_TYPE = "auth/logout";
export const TOKEN_REFRESHED_SUCCESS = "auth/tokenRefreshedSuccess";

export const isDebugEnabled = (value?: string): boolean => value === "true";

export const AUTH_DEBUG = isDebugEnabled(Constants.expoConfig?.extra?.AUTH_DEBUG);
export const logAuthDebugEnabled = (authDebug: boolean): void => {
  if (authDebug) {
    console.debug("AUTH_DEBUG is enabled");
  }
};
logAuthDebugEnabled(AUTH_DEBUG);

export const logAuthWithDebug = (authDebug: boolean, ...args: string[]): void => {
  if (authDebug) {
    console.debug(...args);
  }
};

export const logAuth = (...args: string[]): void => {
  logAuthWithDebug(AUTH_DEBUG, ...args);
};

// Handy debug logging socket events, but not enabled by default.
// Can also be enabled by user feature flag.
const WEBSOCKETS_DEBUG = isDebugEnabled(Constants.expoConfig?.extra?.WEBSOCKETS_DEBUG);
export const logWebsocketsDebugEnabled = (websocketsDebug: boolean): void => {
  if (websocketsDebug) {
    console.debug("WEBSOCKETS_DEBUG is enabled");
  }
};
logWebsocketsDebugEnabled(WEBSOCKETS_DEBUG);

export const shouldLogSocket = (
  user?: {featureFlags?: {debugWebsockets?: {enabled?: boolean}}} | boolean,
  websocketsDebug = WEBSOCKETS_DEBUG
): boolean => {
  if (typeof user === "boolean") {
    return user;
  }

  return Boolean(user?.featureFlags?.debugWebsockets?.enabled || websocketsDebug);
};

// Handy debug logging for websockets, enabled by user.featureFlags.debugWebsockets.enabled or passing in true.
export const logSocket = (
  user?: {featureFlags?: {debugWebsockets?: {enabled?: boolean}}} | boolean,
  ...args: string[]
): void => {
  if (shouldLogSocket(user)) {
    console.debug(`[websocket]`, ...args);
  }
};

export const hasUnsupportedExpoTunnel = (debuggerHost?: string): boolean =>
  Boolean(debuggerHost?.includes("exp.direct"));

export const warnUnsupportedExpoTunnel = (debuggerHost?: string): void => {
  // When we use "expo publish", we want to point the API at the prod API. In the future,
  // we'll want to point at the staging API, and probably have a development release channel.
  if (hasUnsupportedExpoTunnel(debuggerHost)) {
    console.error(
      "Expo Tunnel is not currently supported for connecting to the API, please use LAN or Local mode."
    );
  }
};
warnUnsupportedExpoTunnel(Constants.expoGoConfig?.debuggerHost);

export let baseUrl: string;
export let baseWebsocketsUrl: string;
export let baseTasksUrl: string;

export interface ResolveBaseUrlsOptions {
  apiUrl?: string;
  appEnv?: string;
  baseUrlOverride?: string;
  experienceUrl?: string;
  hostUri?: string;
  isDev: boolean;
}

export interface ResolvedBaseUrls {
  baseTasksUrl: string;
  baseUrl: string;
  baseWebsocketsUrl: string;
  debugContext?: string;
  debugMessage: string;
}

const getUrlsFromApiBase = (apiBase: string): Omit<ResolvedBaseUrls, "debugMessage"> => ({
  baseTasksUrl: `${apiBase.replace("api.", "tasks.")}/tasks`,
  baseUrl: apiBase,
  baseWebsocketsUrl: `${apiBase.replace("api.", "ws.")}/`,
});

const getUrlsFromHostUri = (hostUri: string): Omit<ResolvedBaseUrls, "debugContext" | "debugMessage"> => {
  const host = hostUri.split(`:`).shift() ?? "localhost";

  return {
    baseTasksUrl: `http://${host}:4000/tasks`,
    baseUrl: `http://${host}:4000`,
    baseWebsocketsUrl: `ws://${host}:4000/`,
  };
};

const getUrlsFromExperienceUrl = (
  experienceUrl: string
): Omit<ResolvedBaseUrls, "debugContext" | "debugMessage"> => {
  const host = experienceUrl.split(`:`)[1] ?? "//localhost";

  return {
    baseTasksUrl: `http:${host}:4000/tasks`,
    baseUrl: `http:${host}:4000`,
    baseWebsocketsUrl: `ws:${host}:4000/`,
  };
};

const getUrlsFromLocalhost = (): Omit<ResolvedBaseUrls, "debugContext" | "debugMessage"> => ({
  baseTasksUrl: `http://localhost:4000/tasks`,
  baseUrl: `http://localhost:4000`,
  baseWebsocketsUrl: `ws://localhost:4000/`,
});

export const resolveBaseUrls = ({
  apiUrl,
  appEnv,
  baseUrlOverride,
  experienceUrl,
  hostUri,
  isDev,
}: ResolveBaseUrlsOptions): ResolvedBaseUrls => {
  if (apiUrl) {
    const urls = getUrlsFromApiBase(apiUrl);

    return {
      ...urls,
      debugMessage: `Base URL set to apiUrl ${urls.baseUrl} for env ${
        appEnv ?? "unknown"
      }, websocket to ${urls.baseWebsocketsUrl}, tasks to ${urls.baseTasksUrl}`,
    };
  }

  if (isDev && hostUri) {
    const urls = getUrlsFromHostUri(hostUri);

    return {
      ...urls,
      debugContext: hostUri,
      debugMessage: `Base URL set to hostUri ${urls.baseUrl}, websocket to ${urls.baseWebsocketsUrl}`,
    };
  }

  if (isDev && experienceUrl) {
    const urls = getUrlsFromExperienceUrl(experienceUrl);

    return {
      ...urls,
      debugContext: hostUri,
      debugMessage: `Base URL set to experienceUrl ${urls.baseUrl}, websocket to ${urls.baseWebsocketsUrl}`,
    };
  }

  if (isDev) {
    const urls = getUrlsFromLocalhost();

    return {
      ...urls,
      debugMessage: `Base URL set to localhost ${urls.baseUrl}, websocket to ${urls.baseWebsocketsUrl}`,
    };
  }

  if (baseUrlOverride) {
    const urls = getUrlsFromApiBase(baseUrlOverride);

    return {
      ...urls,
      debugMessage: `Base URL set to apiUrl ${urls.baseUrl} for env ${
        appEnv ?? "unknown"
      }, websocket to ${urls.baseWebsocketsUrl}, tasks to ${urls.baseTasksUrl}`,
    };
  }

  if (hostUri) {
    const urls = getUrlsFromHostUri(hostUri);

    return {
      ...urls,
      debugContext: hostUri,
      debugMessage: `Base URL set to hostUri ${urls.baseUrl}, websocket to ${urls.baseWebsocketsUrl}`,
    };
  }

  if (experienceUrl) {
    const urls = getUrlsFromExperienceUrl(experienceUrl);

    return {
      ...urls,
      debugContext: hostUri,
      debugMessage: `Base URL set to experienceUrl ${urls.baseUrl}, websocket to ${urls.baseWebsocketsUrl}`,
    };
  }

  const urls = getUrlsFromLocalhost();

  return {
    ...urls,
    debugMessage: `Base URL set to localhost ${urls.baseUrl}, websocket to ${urls.baseWebsocketsUrl}`,
  };
};

export const logResolvedBaseUrls = (resolved: ResolvedBaseUrls): void => {
  if (resolved.debugContext === undefined) {
    console.debug(resolved.debugMessage);
  } else {
    console.debug(resolved.debugMessage, resolved.debugContext);
  }
};

const isDev = typeof __DEV__ !== "undefined" && __DEV__;
const resolvedBaseUrls = resolveBaseUrls({
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  appEnv: Constants.expoConfig?.extra?.APP_ENV,
  baseUrlOverride: Constants.expoConfig?.extra?.BASE_URL,
  experienceUrl: Constants.experienceUrl,
  hostUri: Constants.expoConfig?.hostUri,
  isDev,
});

baseUrl = resolvedBaseUrls.baseUrl;
baseWebsocketsUrl = resolvedBaseUrls.baseWebsocketsUrl;
baseTasksUrl = resolvedBaseUrls.baseTasksUrl;
logResolvedBaseUrls(resolvedBaseUrls);
