// This file is the basis for openApiSdk.ts. See openapi-config.ts for configuration that is
// combined with this to generate the SDK.
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  type BaseQueryApi,
  createApi,
  type FetchArgs,
  fetchBaseQuery,
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
import {generateProfileEndpoints, getAuthToken} from "./authSlice";
import {AUTH_DEBUG, baseUrl, LOGOUT_ACTION_TYPE, TOKEN_REFRESHED_SUCCESS} from "./constants";
import {IsWeb} from "./platform";

const log = AUTH_DEBUG ? (s: string): void => console.debug(`[auth] ${s}`) : (): void => {};

axiosRetry(axios, {retries: 3, retryDelay: axiosRetry.exponentialDelay});

const mutex = new Mutex();

interface TokenPayload {
  exp: number;
}

export async function getTokenExpirationTimes(): Promise<{
  refreshRemainingSecs?: number;
  authRemainingSecs?: number;
}> {
  let refreshToken: string | null;
  let authToken: string | null;
  if (!IsWeb) {
    refreshToken = await SecureStore.getItemAsync("REFRESH_TOKEN");
    authToken = await SecureStore.getItemAsync("AUTH_TOKEN");
  } else {
    // Check if we're in a browser environment (not SSR)
    if (typeof window !== "undefined") {
      refreshToken = await AsyncStorage.getItem("REFRESH_TOKEN");
      authToken = await AsyncStorage.getItem("AUTH_TOKEN");
    } else {
      refreshToken = null;
      authToken = null;
    }
  }

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
  let refreshToken: string | null;
  if (!IsWeb) {
    refreshToken = await SecureStore.getItemAsync("REFRESH_TOKEN");
  } else {
    // Check if we're in a browser environment (not SSR)
    if (typeof window !== "undefined") {
      refreshToken = await AsyncStorage.getItem("REFRESH_TOKEN");
    } else {
      refreshToken = null;
    }
  }
  console.debug("Refreshing token, current token");
  if (refreshToken) {
    const refreshResult = await axios.post(`${baseUrl}/auth/refresh_token`, {
      refreshToken,
    });
    console.debug("Refresh token result");
    if (refreshResult?.data?.data) {
      const data = refreshResult.data.data;
      if (!data.token || !data.refreshToken) {
        console.warn("refresh token API request didn't return data");
        throw new Error("refresh token API request didn't return data");
      }
      if (!IsWeb) {
        await SecureStore.setItemAsync("AUTH_TOKEN", data.token);
        await SecureStore.setItemAsync("REFRESH_TOKEN", data.refreshToken);
      } else {
        // Check if we're in a browser environment (not SSR)
        if (typeof window !== "undefined") {
          await AsyncStorage.setItem("AUTH_TOKEN", data.token);
          await AsyncStorage.setItem("REFRESH_TOKEN", data.refreshToken);
        }
      }
      axios.defaults.headers.common.Authorization = `Bearer ${data.token}`;
      console.debug("New token stored");
    } else {
      console.warn("refresh token API request failed or didn't return data");
      throw new Error("refresh token API request failed or didn't return data");
    }
  } else {
    console.warn("no refresh token found");
    throw new Error("no refresh token found");
  }
};

const getBaseQuery = (
  args: string | FetchArgs,
  api: BaseQueryApi,
  extraOptions: unknown,
  token: string | null
) => {
  const version = Constants.expoConfig?.version ?? "Unknown";

  return fetchBaseQuery({
    baseUrl: `${baseUrl}`,
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
        // For read, update, and create responses, return the data. We used to use a transformer,
        // but
        return result.data;
      } else {
        return result;
      }
    },
    // biome-ignore lint/suspicious/noExplicitAny: Weird typing from rtk query
  })(args, api, extraOptions as any);
};

const staggeredBaseQuery = retry(
  async (args: string | FetchArgs, api, extraOptions) => {
    // wait until the mutex is available without locking it
    await mutex.waitForUnlock();
    let token = await getAuthToken();

    console.log("TOKEN", token, api.endpoint);
    if (!token && ["emailLogin", "googleLogin", "getZoomSignature"].includes(api.endpoint)) {
      // just pass thru the request without a token if it is a login request
      return getBaseQuery(args, api, extraOptions, token);
    } else if (!token) {
      console.debug(`No token found and the endpoint is ${api.endpoint}`);
      // assume the token was removed because the user logged out and dispatch logout
      api.dispatch({type: LOGOUT_ACTION_TYPE});
      return {error: {error: `No token found for ${api.endpoint}`, status: "FETCH_ERROR"}};
    }

    const {refreshRemainingSecs, authRemainingSecs} = await getTokenExpirationTimes();
    // if both auth and refresh tokens exist but are expired, log the user out
    if (
      authRemainingSecs &&
      authRemainingSecs < 0 &&
      refreshRemainingSecs &&
      refreshRemainingSecs < 0
    ) {
      console.warn(
        `[auth] Both tokens are expired, logging out: authRemainingSecs: ${authRemainingSecs}, refreshRemainingSecs: ${refreshRemainingSecs}`
      );
      api.dispatch({type: LOGOUT_ACTION_TYPE});
      return {error: {error: "Auth and refresh tokens are expired", status: "FETCH_ERROR"}};
    }

    // if the auth token is within about 2 minute of expiring, refresh it automatically
    if (authRemainingSecs && authRemainingSecs < 130) {
      if (!mutex.isLocked()) {
        const release = await mutex.acquire();
        try {
          log(`Refreshing token: authRemainingSecs: ${authRemainingSecs}`);
          await refreshAuthToken();
          token = await getAuthToken();
          log(`Token refreshed: ${token}`);
          api.dispatch({type: TOKEN_REFRESHED_SUCCESS});
        } catch (error: unknown) {
          // if it is of type AxiosError
          if (axios.isAxiosError(error)) {
            // if it is a Network Error, don't auto log out and just let the next request go
            // through
            console.warn(`[auth] Network error refreshing token: ${error.code} ${error.message}`);
            if (error.code === "ERR_NETWORK") {
              return getBaseQuery(args, api, extraOptions, token);
            } else if (error.status === 401) {
              api.dispatch({type: LOGOUT_ACTION_TYPE});
              return {error: {error: "Token refresh failed with 401", status: "FETCH_ERROR"}};
            }
          }
          console.warn(
            `[auth] Error refreshing token: ${error instanceof Error ? error.message : String(error)}`
          );
          api.dispatch({type: LOGOUT_ACTION_TYPE});
          return {
            error: {
              error: `Failed to refresh token: ${error instanceof Error ? error.message : String(error)}`,
              status: "FETCH_ERROR",
            },
          };
        } finally {
          release();
        }
      }
    } else {
      // wait until the mutex is available
      log(`Waiting for mutex to get token: authRemainingSecs: ${authRemainingSecs}`);
      await mutex.waitForUnlock();
      token = await getAuthToken();
    }

    let baseQuery = getBaseQuery(args, api, extraOptions, token);
    let result = await baseQuery;

    if (result.error?.status === 401) {
      if (!mutex.isLocked()) {
        console.warn("[auth] 401 error, refreshing token and retrying, waiting for mutex");
        const release = await mutex.acquire();
        log("401 error, refreshing token and retrying, got mutex");
        try {
          await refreshAuthToken();
          token = await getAuthToken();
          log(`401 error, refreshing token and retrying, got new token: ${token}`);
          api.dispatch({type: TOKEN_REFRESHED_SUCCESS});
          baseQuery = getBaseQuery(args, api, extraOptions, token);
          // retry once with the new token before failing and logging out
          result = await baseQuery;
        } catch (error: unknown) {
          console.error(
            "Error refreshing auth token",
            error instanceof Error ? error.message : String(error)
          );
          api.dispatch({type: LOGOUT_ACTION_TYPE});
        } finally {
          release();
        }
      } else {
        // wait until the mutex is available without locking it then try again since got 401 on
        // first try
        console.warn(
          "401 error and mutex locked, refreshing token and retrying, waiting for mutex"
        );
        await mutex.waitForUnlock();
        token = await getAuthToken();
        log(`401 error and mutex locked, refreshing token and retrying, got new token: ${token}`);
        baseQuery = getBaseQuery(args, api, extraOptions, token);
        result = await baseQuery;
      }
      // if any other type of error, don't retry if it is a mutation to prevent potential duplicates
    } else if (result.error && api.type === "mutation") {
      log(`Error on mutation, not retrying, ${authRemainingSecs}`);
      retry.fail(result.error);
    }
    return result;
  },
  {
    maxRetries: 3,
  }
);

// initialize an empty api service that we'll inject endpoints into later as needed
export const emptySplitApi = createApi({
  baseQuery: staggeredBaseQuery,
  endpoints: (builder) => ({
    // biome-ignore lint/suspicious/noExplicitAny: Generic
    ...generateProfileEndpoints(builder as any, "users"), // using 'users' here since it is highly intertwined with Users
  }),
  reducerPath: "terreno-rtk",
});
