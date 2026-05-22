// This file is the basis for openApiSdk.ts. See openapi-config.ts for configuration that is
// combined with this to generate the SDK.
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type BaseQueryApi,
  createApi,
  type FetchArgs,
  fetchBaseQuery,
  type QueryReturnValue,
  retry,
} from "@reduxjs/toolkit/query/react";
import {Mutex} from "async-mutex";
import axios from "axios";
import axiosRetry from "axios-retry";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import {jwtDecode} from "jwt-decode";
import {DateTime} from "luxon";
import qs from "qs";
import {generateProfileEndpoints, getAuthToken, getRefreshToken} from "./authSlice";
import {
  AUTH_DEBUG,
  baseTasksUrl,
  baseUrl,
  LOGOUT_ACTION_TYPE,
  TOKEN_REFRESHED_SUCCESS,
} from "./constants";
import {IsWeb} from "./platform";

const log = AUTH_DEBUG ? (s: string): void => console.debug(`[auth] ${s}`) : (): void => {};

axiosRetry(axios, {retries: 3, retryDelay: axiosRetry.exponentialDelay});

const mutex = new Mutex();

interface TokenPayload {
  exp: number;
}

export interface CreateEmptyApiOptions {
  /** Reducer path for the RTK Query API. Defaults to "terreno-rtk". */
  reducerPath?: string;
  /**
   * RTK endpoint names that never require an auth token. Includes login and
   * anonymous/public endpoints. Defaults to ["emailLogin", "emailSignUp", "googleLogin"].
   * If a request to one of these arrives with a stored token that has fully
   * expired (both auth and refresh past expiry), the base query dispatches
   * LOGOUT_ACTION_TYPE so the listener middleware clears storage, but still
   * proceeds with a null token so the user can sign in on the first try.
   */
  unauthenticatedEndpoints?: string[];
  /**
   * RTK endpoint names that work both authenticated and anonymously. The token
   * is forwarded when present and not-yet-expired so the server can identify
   * the caller; expired or missing tokens fall back to an anonymous request.
   * No logout is ever dispatched for these endpoints.
   */
  optionalAuthEndpoints?: string[];
  /**
   * If a request URL starts with this prefix, route it to baseTasksUrl with the
   * prefix stripped (since baseTasksUrl already includes the tasks segment).
   * Example: "/tasks/" routes "/tasks/foo" to `${baseTasksUrl}/foo`.
   * Defaults to undefined (no tasks URL routing).
   */
  tasksUrlPrefix?: string;
}

const DEFAULT_UNAUTHENTICATED_ENDPOINTS = ["emailLogin", "emailSignUp", "googleLogin"];

/**
 * The token value that was most recently stored by a successful auto-refresh.
 * Sequential requests against a short-lived token (lifetime shorter than the
 * 130s pre-expiry refresh window) would otherwise each kick off their own
 * refresh because each one sees a freshly-refreshed but still short-lived
 * token. Remembering what we last refreshed to lets us detect and skip the
 * redundant case. Reset on module init (app start / hot reload).
 */
let lastRefreshedToken: string | null = null;

/** Resets auto-refresh module state. Call only from tests. */
export const __resetRefreshState = (): void => {
  lastRefreshedToken = null;
};

export async function getTokenExpirationTimes(): Promise<{
  refreshRemainingSecs?: number;
  authRemainingSecs?: number;
}> {
  const [authToken, refreshToken] = await Promise.all([getAuthToken(), getRefreshToken()]);
  if (!refreshToken || !authToken) {
    return {authRemainingSecs: undefined, refreshRemainingSecs: undefined};
  }

  const now = DateTime.now().setZone("UTC");
  const refreshDecoded = jwtDecode<TokenPayload>(refreshToken);
  const authDecoded = jwtDecode<TokenPayload>(authToken);

  const refreshExpiration = DateTime.fromSeconds(refreshDecoded.exp).setZone("UTC");
  const authExpiration = DateTime.fromSeconds(authDecoded.exp).setZone("UTC");

  const refreshTimeRemaining = Math.floor(refreshExpiration.diff(now, "seconds").seconds);
  const authTimeRemaining = Math.floor(authExpiration.diff(now, "seconds").seconds);

  if (AUTH_DEBUG) {
    log(`Refresh expires in ${refreshTimeRemaining}s, Auth expires in ${authTimeRemaining}s`);
  }

  return {authRemainingSecs: authTimeRemaining, refreshRemainingSecs: refreshTimeRemaining};
}

// Helper function to decode token and get expiration info
export const getFriendlyExpirationInfo = async (): Promise<string> => {
  const {authRemainingSecs, refreshRemainingSecs} = await getTokenExpirationTimes();

  if (authRemainingSecs === undefined && refreshRemainingSecs === undefined) {
    return "No tokens available";
  }

  const messages: string[] = [];
  if (authRemainingSecs !== undefined) {
    if (authRemainingSecs <= 0) {
      messages.push(`Auth token expired ${Math.abs(authRemainingSecs)} seconds ago`);
    } else {
      messages.push(`Auth token expires in ${authRemainingSecs} seconds`);
    }
  }

  if (refreshRemainingSecs !== undefined) {
    if (refreshRemainingSecs <= 0) {
      messages.push(`Refresh token expired ${Math.abs(refreshRemainingSecs)} seconds ago`);
    } else {
      messages.push(`Refresh token expires in ${refreshRemainingSecs} seconds`);
    }
  }

  return messages.join(", ");
};

// Give an extra 5 seconds to make sure if they hit the modal with 1 minute left,
// they have time to click the button
export const shouldShowStillThereModal = async (): Promise<boolean> => {
  const {refreshRemainingSecs} = await getTokenExpirationTimes();
  if (refreshRemainingSecs === undefined) {
    return false;
  }
  return refreshRemainingSecs <= 65;
};

export const refreshAuthToken = async (): Promise<void> => {
  const refreshToken = await getRefreshToken();
  log("Refreshing token");
  if (!refreshToken) {
    console.warn("no refresh token found");
    throw new Error("no refresh token found");
  }
  const refreshResult = await axios.post(`${baseUrl}/auth/refresh_token`, {refreshToken});
  log("Refresh token result received");
  if (!refreshResult?.data?.data) {
    console.warn("refresh token API request failed or didn't return data");
    throw new Error("refresh token API request failed or didn't return data");
  }
  const data = refreshResult.data.data;
  if (!data.token || !data.refreshToken) {
    console.warn("refresh token API request didn't return data");
    throw new Error("refresh token API request didn't return data");
  }
  if (!IsWeb) {
    await SecureStore.setItemAsync("AUTH_TOKEN", data.token);
    await SecureStore.setItemAsync("REFRESH_TOKEN", data.refreshToken);
  } else if (typeof window !== "undefined") {
    await AsyncStorage.setItem("AUTH_TOKEN", data.token);
    await AsyncStorage.setItem("REFRESH_TOKEN", data.refreshToken);
  }
  axios.defaults.headers.common.Authorization = `Bearer ${data.token}`;
  log("New token stored");
};

export const getBaseQuery = (
  args: string | FetchArgs,
  api: BaseQueryApi,
  extraOptions: unknown,
  token: string | null,
  effectiveBaseUrl: string = baseUrl
) => {
  const version = Constants.expoConfig?.version ?? "Unknown";

  return fetchBaseQuery({
    baseUrl: effectiveBaseUrl,
    // We need to use qs.stringify here because fetchBaseQuery uses the qs library which doesn't
    // support nested objects, such as our $in, $lt/$gte, etc queries.
    paramsSerializer: (params) => {
      return qs.stringify(params);
    },
    prepareHeaders: async (headers) => {
      headers.set("authorization", `Bearer ${token}`);
      // Send version in case the API needs to respond differently based on version.
      headers.set("App-Version", version);
      headers.set("App-Platform", IsWeb ? "web" : "mobile");
      return headers;
    },
    // We need to slightly change the format of the data coming from the API to match the format
    // that the SDK generates.
    responseHandler: async (response) => {
      if (response.status === 204) {
        return null;
      }
      const result = await response.json();
      if ("more" in result) {
        // For list responses, return the whole result
        return result;
      } else if (result.data) {
        return result.data;
      } else {
        return result;
      }
    },
    // biome-ignore lint/suspicious/noExplicitAny: Weird typing from rtk query
  })(args, api, extraOptions as any);
};

/**
 * Returns true only when the Redux store has a userId. The guard prevents
 * in-flight requests that arrive after a logout has cleared state from
 * re-dispatching LOGOUT_ACTION_TYPE and cascading into more refresh attempts.
 */
const isUserLoggedIn = (api: BaseQueryApi): boolean => {
  const userId = (api.getState() as {auth?: {userId?: unknown}})?.auth?.userId;
  return userId != null;
};

const dispatchLogoutIfLoggedIn = (api: BaseQueryApi): void => {
  if (isUserLoggedIn(api)) {
    api.dispatch({type: LOGOUT_ACTION_TYPE});
  }
};

/**
 * Build a configurable RTK Query base query with JWT auth, automatic token
 * refresh, and retry logic. Wrapped with `retry({maxRetries: 3})`. Logout
 * paths use `retry.fail()` to immediately bail out of the retry loop —
 * returning a plain error allows the retry wrapper to re-run the query and
 * re-dispatch logout on each attempt.
 *
 * Network errors are tolerated during refresh: `ERR_NETWORK` falls through to
 * the base query so the user stays logged in across transient outages.
 *
 * Auto-refresh and 401 recovery both use double-checked locking around the
 * mutex: every concurrent request acquires the mutex (not just the first
 * one to find it unlocked) and re-checks the stored token after acquiring.
 * Only the first holder refreshes; the rest skip when they detect either a
 * concurrent refresh (currentToken changed) or a sequential refresh of the
 * same short-lived token (currentToken === lastRefreshedToken).
 *
 * Every LOGOUT_ACTION_TYPE dispatch is guarded by `isUserLoggedIn`.
 */
export const createBaseQuery = (options: CreateEmptyApiOptions = {}) => {
  const unauthenticatedEndpoints =
    options.unauthenticatedEndpoints ?? DEFAULT_UNAUTHENTICATED_ENDPOINTS;
  const optionalAuthEndpoints = options.optionalAuthEndpoints ?? [];
  const tasksUrlPrefix = options.tasksUrlPrefix;

  const buildBaseQuery = (
    args: string | FetchArgs,
    api: BaseQueryApi,
    extraOptions: unknown,
    token: string | null,
    useTasksUrl: boolean
  ) => {
    if (!useTasksUrl || !tasksUrlPrefix) {
      return getBaseQuery(args, api, extraOptions, token);
    }
    // Strip the configured prefix since baseTasksUrl already includes it.
    let effectiveArgs = args;
    if (typeof args === "string" && args.startsWith(tasksUrlPrefix)) {
      effectiveArgs = args.replace(tasksUrlPrefix, "/");
    } else if (typeof args === "object" && args.url?.startsWith(tasksUrlPrefix)) {
      effectiveArgs = {...args, url: args.url.replace(tasksUrlPrefix, "/")};
    }
    return getBaseQuery(effectiveArgs, api, extraOptions, token, baseTasksUrl);
  };

  const inner = async (
    args: string | FetchArgs,
    api: BaseQueryApi,
    extraOptions: unknown
  ): Promise<QueryReturnValue<unknown, unknown, Record<string, unknown>>> => {
    // wait until the mutex is available without locking it
    await mutex.waitForUnlock();
    let token = await getAuthToken();

    const url = typeof args === "string" ? args : args.url;
    const useTasksUrl = !!(tasksUrlPrefix && url?.startsWith(tasksUrlPrefix));

    // Login and anonymous endpoints never require an auth token. If stale
    // expired tokens are present in storage (session timed out without an
    // explicit logout), dispatch cleanup so the listener middleware clears
    // them — but proceed with null so the user can sign in on the first try.
    if (unauthenticatedEndpoints.includes(api.endpoint)) {
      if (token) {
        const {authRemainingSecs, refreshRemainingSecs} = await getTokenExpirationTimes();
        if (
          authRemainingSecs !== undefined &&
          authRemainingSecs < 0 &&
          refreshRemainingSecs !== undefined &&
          refreshRemainingSecs < 0
        ) {
          api.dispatch({type: LOGOUT_ACTION_TYPE});
        }
      }
      return buildBaseQuery(args, api, extraOptions, null, useTasksUrl);
    }

    // Optional-auth endpoints: send the token when present and valid so the
    // server can identify the caller; otherwise fall back to anonymous.
    if (optionalAuthEndpoints.includes(api.endpoint)) {
      if (token) {
        const {authRemainingSecs} = await getTokenExpirationTimes();
        const authExpired = authRemainingSecs !== undefined && authRemainingSecs < 0;
        return buildBaseQuery(args, api, extraOptions, authExpired ? null : token, useTasksUrl);
      }
      return buildBaseQuery(args, api, extraOptions, null, useTasksUrl);
    }

    if (!token) {
      console.debug(`No token found and the endpoint is ${api.endpoint}`);
      dispatchLogoutIfLoggedIn(api);
      // bail out — do not retry, tokens are gone
      retry.fail({error: `No token found for ${api.endpoint}`, status: "FETCH_ERROR"});
    }

    const {refreshRemainingSecs, authRemainingSecs} = await getTokenExpirationTimes();
    if (
      authRemainingSecs !== undefined &&
      authRemainingSecs < 0 &&
      refreshRemainingSecs !== undefined &&
      refreshRemainingSecs < 0
    ) {
      console.warn(
        `[auth] Both tokens are expired, logging out: authRemainingSecs: ${authRemainingSecs}, refreshRemainingSecs: ${refreshRemainingSecs}`
      );
      dispatchLogoutIfLoggedIn(api);
      // bail out — do not retry, both tokens are expired
      retry.fail({error: "Auth and refresh tokens are expired", status: "FETCH_ERROR"});
    }

    // Auto-refresh ahead of expiry: 130 s threshold.
    if (authRemainingSecs !== undefined && authRemainingSecs < 130) {
      const tokenBeforeRefresh = token;
      const release = await mutex.acquire();
      try {
        const currentToken = await getAuthToken();
        const alreadyServiced =
          currentToken !== tokenBeforeRefresh ||
          (currentToken === lastRefreshedToken && authRemainingSecs >= 0);
        if (alreadyServiced) {
          log(`Token already refreshed (concurrent or sequential), skipping`);
          token = currentToken as string;
        } else {
          log(`Refreshing token: authRemainingSecs: ${authRemainingSecs}`);
          await refreshAuthToken();
          lastRefreshedToken = await getAuthToken();
          token = lastRefreshedToken as string;
          api.dispatch({type: TOKEN_REFRESHED_SUCCESS});
        }
        log(`Token after refresh check`);
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          console.warn(`[auth] Network error refreshing token: ${error.code} ${error.message}`);
          if (error.code === "ERR_NETWORK") {
            return buildBaseQuery(args, api, extraOptions, token, useTasksUrl);
          } else if (error.status === 401) {
            dispatchLogoutIfLoggedIn(api);
            // bail out — do not retry, refresh token was rejected
            retry.fail({error: "Token refresh failed with 401", status: "FETCH_ERROR"});
          }
        }
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[auth] Error refreshing token: ${message}`);
        dispatchLogoutIfLoggedIn(api);
        // bail out — do not retry, token refresh failed
        retry.fail({error: `Failed to refresh token: ${message}`, status: "FETCH_ERROR"});
      } finally {
        release();
      }
    } else {
      // wait until the mutex is available
      log(`Waiting for mutex to get token: authRemainingSecs: ${authRemainingSecs}`);
      await mutex.waitForUnlock();
      token = await getAuthToken();
    }

    let baseQuery = buildBaseQuery(args, api, extraOptions, token, useTasksUrl);
    let result = await baseQuery;

    if (result.error?.status === 401) {
      // If already logged out, don't attempt to refresh — tokens are gone.
      // In-flight requests that return 401 after logout should silently bail.
      if (!isUserLoggedIn(api)) {
        retry.fail(result.error);
      }
      console.warn("[auth] 401 error, acquiring mutex for token refresh");
      const release401 = await mutex.acquire();
      try {
        // Re-check after acquiring: if another holder already refreshed, the
        // stored token will differ from the one that received the 401.
        const currentToken = await getAuthToken();
        if (currentToken !== token) {
          log(`401 error: token already refreshed by concurrent holder, retrying`);
          token = currentToken as string;
        } else {
          await refreshAuthToken();
          token = await getAuthToken();
          lastRefreshedToken = token;
          log(`401 error, refreshing token and retrying, got new token`);
          api.dispatch({type: TOKEN_REFRESHED_SUCCESS});
        }
        // If logout completed while waiting for the mutex, bail silently.
        if (!isUserLoggedIn(api)) {
          retry.fail(result.error);
        }
        baseQuery = buildBaseQuery(args, api, extraOptions, token, useTasksUrl);
        result = await baseQuery;
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.code === "ERR_NETWORK") {
          console.warn("[auth] Network error during 401 token refresh; skipping logout");
          // fall through and return the original 401 result — retry handles it
        } else {
          console.error("Error refreshing auth token", error);
          dispatchLogoutIfLoggedIn(api);
          // bail out — do not retry, token refresh after 401 failed
          retry.fail(result.error);
        }
      } finally {
        release401();
      }
      // if any other type of error, don't retry if it is a mutation to prevent potential duplicates
    } else if (result.error && api.type === "mutation") {
      log(`Error on mutation, not retrying`);
      retry.fail(result.error);
    }
    return result;
  };

  return retry(inner, {maxRetries: 3});
};

export const staggeredBaseQuery = createBaseQuery();

export const createEmptyApi = (options: CreateEmptyApiOptions = {}) =>
  createApi({
    baseQuery: createBaseQuery(options),
    endpoints: (builder) => ({
      // biome-ignore lint/suspicious/noExplicitAny: Generic
      ...generateProfileEndpoints(builder as any, "users"), // using 'users' here since it is highly intertwined with Users
    }),
    reducerPath: options.reducerPath ?? "terreno-rtk",
  });

// initialize an empty api service that we'll inject endpoints into later as needed
export const emptySplitApi = createEmptyApi();
