// Cookie-session base API for web apps authenticated via Better Auth session cookies
// (e.g. the admin SPA served from a Terreno backend). Unlike emptyApi's
// staggeredBaseQuery, this base query has no JWT token handling: it never reads
// token storage, never refreshes tokens, and never dispatches the global logout
// action when a request fails. Auth state is owned entirely by the better-auth
// session cookie, which the browser sends automatically on same-origin requests.
import {createApi, fetchBaseQuery} from "@reduxjs/toolkit/query/react";
import qs from "qs";

interface CreateSessionApiOptions {
  /**
   * Base URL for API requests. Defaults to "" so paths resolve against the current
   * origin on web (the SPA is served by the same backend that hosts the API).
   */
  baseUrl?: string;
  /** Redux reducer path for the generated api. Defaults to "terreno-session". */
  reducerPath?: string;
}

/**
 * Creates an empty RTK Query API that authenticates with same-origin session cookies
 * instead of JWT bearer tokens. Response shaping matches emptyApi: list responses
 * (with `more`) are returned whole, and `{data}` envelopes are unwrapped.
 */
export const createSessionApi = ({
  baseUrl = "",
  reducerPath = "terreno-session",
}: CreateSessionApiOptions = {}) => {
  const sessionBaseQuery = fetchBaseQuery({
    baseUrl,
    credentials: "same-origin",
    // qs supports the nested objects ($in, $lt/$gte, etc.) our list queries use.
    paramsSerializer: (params) => qs.stringify(params),
    responseHandler: async (response) => {
      if (response.status === 204) {
        return null;
      }
      const result = await response.json();
      if (result && typeof result === "object" && "more" in result) {
        return result;
      }
      if (result?.data) {
        return result.data;
      }
      return result;
    },
  });

  return createApi({
    baseQuery: sessionBaseQuery,
    endpoints: () => ({}),
    reducerPath,
  });
};
