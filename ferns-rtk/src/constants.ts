import Constants from "expo-constants";

// biome-ignore lint/suspicious/noExplicitAny: RootState is hard to type without becoming circular.
export type RootState = any;
export const LOGOUT_ACTION_TYPE = "auth/logout";
export const TOKEN_REFRESHED_SUCCESS = "auth/tokenRefreshedSuccess";

export const AUTH_DEBUG = Constants.expoConfig?.extra?.AUTH_DEBUG === "true";
if (AUTH_DEBUG) {
	console.info("AUTH_DEBUG is enabled");
}

export const logAuth = (...args: string[]): void => {
	if (AUTH_DEBUG) {
		console.debug(...args);
	}
};

// Handy debug logging for form presence, but not enabled by default.
const FORM_PRESENCE_DEBUG = Constants.expoConfig?.extra?.FORM_PRESENCE_DEBUG === "true";
if (FORM_PRESENCE_DEBUG) {
	console.info("FORM_PRESENCE_DEBUG is enabled");
}
export const logFormPresence = (...args: string[]): void => {
	if (FORM_PRESENCE_DEBUG) {
		console.debug(...args);
	}
};

// Handy debug logging for form presence or other socket events, but not enabled by default.
// Can also be enabled by user feature flag.
const WEBSOCKETS_DEBUG = Constants.expoConfig?.extra?.WEBSOCKETS_DEBUG === "true";
if (WEBSOCKETS_DEBUG) {
	console.info("WEBSOCKETS_DEBUG is enabled");
}

// Handy debug logging for websockets, enabled by user feature flag
export const logSocket = (
	user?: {featureFlags?: {debugWebsockets?: {enabled?: boolean}}},
	...args: string[]
): void => {
	if (user?.featureFlags?.debugWebsockets?.enabled || WEBSOCKETS_DEBUG) {
		console.debug(`[websocket]`, ...args);
	}
};

// Emit a focus event every 5 seconds while the question is focused.
export const FORM_PRESENCE_INTERVAL_MS = 5000;
// If we haven't received a focus event for the past 15 seconds, consider the question blurred.
// The user may have navigated away from the question.
export const FORM_PRESENCE_BLUR_TIMEOUT_MS = 15000;
// Ensure the blur from the previous question has been sent before emitting the focus for this
// question
export const FORM_PRESENCE_DELAY_MS = 200;

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

if (Constants.expoConfig?.extra?.BASE_URL) {
	// For prod/staging
	baseUrl = Constants.expoConfig?.extra?.BASE_URL;
	baseWebsocketsUrl = `${baseUrl.replace("api.", "ws.")}/`;
	baseTasksUrl = `${baseUrl.replace("api.", "tasks.")}/tasks`;

	console.info(
		`Base URL set to apiUrl ${baseUrl} for env ${
			Constants.expoConfig?.extra?.APP_ENV ?? "unknown"
		}, websocket to ${baseWebsocketsUrl}, tasks to ${baseTasksUrl}`
	);
} else if (Constants.expoConfig?.hostUri) {
	// For dev simulator/device
	baseUrl = `http://${Constants.expoConfig?.hostUri?.split(`:`).shift()?.concat(":3000")}`;
	baseWebsocketsUrl = `ws://${Constants.expoConfig?.hostUri?.split(`:`).shift()?.concat(":3000")}/`;
	baseTasksUrl = `http://${Constants.expoConfig?.hostUri?.split(`:`).shift()?.concat(":3000")}/tasks`;
	console.info(
		`Base URL set to hostUri ${baseUrl}, websocket to ${baseWebsocketsUrl}`,
		Constants.expoConfig?.hostUri
	);
} else if (Constants.experienceUrl) {
	// For dev web
	baseUrl = `http:${Constants.experienceUrl?.split(`:`)[1]?.concat(":3000")}`;
	baseWebsocketsUrl = `ws:${Constants.experienceUrl?.split(`:`)[1]?.concat(":3000")}/`;
	baseTasksUrl = `http:${Constants.experienceUrl?.split(`:`)[1]?.concat(":3000")}/tasks`;
	console.info(
		`Base URL set to experienceUrl ${baseUrl}, websocket to ${baseWebsocketsUrl}`,
		Constants.expoConfig?.hostUri
	);
} else if (
	!Constants.expoConfig?.extra?.BASE_URL &&
	!Constants.expoConfig?.hostUri &&
	!Constants.experienceUrl
) {
	// For dev web, which doesn't have experienceUrl for some reason?
	baseUrl = `http://localhost:3000`;
	baseWebsocketsUrl = `ws://localhost:3000/`;
	baseTasksUrl = `http://localhost:3000/tasks`;
	console.info(`Base URL set to localhost ${baseUrl}, websocket to ${baseWebsocketsUrl}`);
} else {
	console.error("No base URL found", Constants.expoConfig, Constants.experienceUrl);
	throw new Error("No base URL found");
}

