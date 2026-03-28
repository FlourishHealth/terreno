import type {Api} from "@reduxjs/toolkit/query/react";
import {useCallback, useEffect, useMemo, useRef} from "react";

type FlagValues = Record<string, boolean | string | null>;


interface UseFeatureFlagsResult {
  flags: FlagValues;
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
  // biome-ignore lint/suspicious/noExplicitAny: RTK Query API generic typing is intentionally flexible here.
  api: Api<any, any, any, any>,
  basePath = "/feature-flags"
): UseFeatureFlagsResult => {
  const enhancedApi = useMemo(
    () =>
      api.injectEndpoints({
        endpoints: (builder) => ({
          evaluateFeatureFlags: builder.query<FlagValues, void>({
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

  // biome-ignore lint/suspicious/noExplicitAny: Endpoint hook is injected dynamically by RTK Query.
  const useEvaluateQuery = (enhancedApi as any).useEvaluateFeatureFlagsQuery;
  const {data, isLoading, error, refetch} = useEvaluateQuery();
  const evaluateStartedAtRef = useRef<number | null>(null);

  const flags: FlagValues = data ?? {};

  // Log when evaluate request enters loading state so client timing can be measured.
  useEffect((): void => {
    if (!isLoading || evaluateStartedAtRef.current !== null) {
      return;
    }

    evaluateStartedAtRef.current = Date.now();
    console.debug("[feature-flags] evaluate request started", {
      basePath,
    });
  }, [basePath, isLoading]);

  // Log evaluate success with duration and number of resolved flag values.
  useEffect((): void => {
    if (!data || evaluateStartedAtRef.current === null) {
      return;
    }

    const durationMs = Date.now() - evaluateStartedAtRef.current;
    evaluateStartedAtRef.current = null;
    console.debug("[feature-flags] evaluate request completed", {
      basePath,
      durationMs,
      evaluatedFlagCount: Object.keys(flags).length,
      evaluatedFlags: flags,
    });
  }, [basePath, data, flags]);

  // Log evaluate failures with duration so request issues can be correlated.
  useEffect((): void => {
    if (!error || evaluateStartedAtRef.current === null) {
      return;
    }

    const durationMs = Date.now() - evaluateStartedAtRef.current;
    evaluateStartedAtRef.current = null;
    console.debug("[feature-flags] evaluate request failed", {
      basePath,
      durationMs,
      error,
    });
  }, [basePath, error]);

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

  return {error, flags, getFlag, getVariant, isLoading, refetch};
};
