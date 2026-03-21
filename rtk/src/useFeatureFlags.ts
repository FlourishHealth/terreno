import type {Api} from "@reduxjs/toolkit/query/react";
import {useCallback, useMemo} from "react";

type FlagValues = Record<string, boolean | string | null>;

interface EvaluateResponse {
  data: FlagValues;
}

interface UseFeatureFlagsResult {
  getFlag: (key: string) => boolean;
  getVariant: (key: string) => string | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

/**
 * Creates feature flag accessors from an RTK Query API instance.
 *
 * Injects a `GET {basePath}/evaluate` endpoint into the API and returns
 * accessors for reading flag values. Fetches once on mount and caches via
 * RTK Query. Both `api` and `basePath` should be stable references.
 *
 * @example
 * ```typescript
 * const { getFlag, getVariant } = useFeatureFlags(terrenoApi);
 *
 * const showNewCheckout = getFlag("new-checkout-flow");       // true | false
 * const variant = getVariant("checkout-experiment");           // "control" | "variant-a" | null
 * ```
 */
export const useFeatureFlags = (
  // biome-ignore lint/suspicious/noExplicitAny: RTK Query API type is complex
  api: Api<any, any, any, any>,
  basePath = "/feature-flags"
): UseFeatureFlagsResult => {
  const enhancedApi = useMemo(
    () =>
      api.injectEndpoints({
        endpoints: (builder) => ({
          evaluateFeatureFlags: builder.query<EvaluateResponse, void>({
            query: () => ({
              method: "GET",
              url: `${basePath}/evaluate`,
            }),
          }),
        }),
        overrideExisting: false,
      }),
    [api, basePath]
  );

  // biome-ignore lint/suspicious/noExplicitAny: Dynamic endpoint access
  const useEvaluateQuery = (enhancedApi as any).useEvaluateFeatureFlagsQuery;
  const {data, isLoading, error, refetch} = useEvaluateQuery();

  const flags: FlagValues = data?.data ?? {};

  const getFlag = useCallback(
    (key: string): boolean => {
      const value = flags[key];
      return value === true;
    },
    [flags]
  );

  const getVariant = useCallback(
    (key: string): string | null => {
      const value = flags[key];
      if (typeof value === "string") {
        return value;
      }
      return null;
    },
    [flags]
  );

  return {error, getFlag, getVariant, isLoading, refetch};
};
