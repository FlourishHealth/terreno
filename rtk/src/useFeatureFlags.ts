import type {Api} from "@reduxjs/toolkit/query/react";
import {DateTime} from "luxon";
import {useCallback, useEffect, useMemo, useRef} from "react";
import {useTerrenoFeatureFlags} from "./useTerrenoFeatureFlags";

interface FlagValues {
  [key: string]: boolean | string | null;
}

// noExplicitAny: RTK Query API generic typing is intentionally flexible here.
// biome-ignore lint/suspicious/noExplicitAny: RTK Query API generic typing is intentionally flexible here.
type FlagsApi = Api<any, any, any, any>;

interface UseFeatureFlagsResult {
  error: unknown;
  flags: FlagValues;
  getFlag: (key: string) => boolean;
  getVariant: (key: string) => string | null;
  isLoading: boolean;
  refetch: () => void;
}

/**
 * Creates feature flag accessors from an RTK Query API instance.
 *
 * Injects a `GET {basePath}/flagConfiguration` endpoint into the API and returns
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
export interface UseFeatureFlagsOptions {
  basePath?: string;
  domain?: string;
  skip?: boolean;
  socket?: {
    off: (event: string, handler: (...args: unknown[]) => void) => void;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
  } | null;
  socketEventName?: string;
  userId?: string | null;
}

interface ResolvedFeatureFlagsOptions {
  basePath: string;
  domain: string;
  skip: boolean;
  socket?: UseFeatureFlagsOptions["socket"];
  socketEventName?: string;
  userId?: string | null;
}

/**
 * Normalizes the legacy-compatible `basePathOrOptions` argument into a
 * `{basePath, skip, ...}` pair with defaults applied.
 */
export const resolveFeatureFlagsOptions = (
  basePathOrOptions?: string | UseFeatureFlagsOptions
): ResolvedFeatureFlagsOptions => {
  const raw =
    typeof basePathOrOptions === "string"
      ? {basePath: basePathOrOptions, skip: false}
      : (basePathOrOptions ?? {});
  return {
    basePath: raw.basePath ?? "/feature-flags",
    domain: raw.domain ?? "feature-flags",
    skip: raw.skip ?? false,
    socket: raw.socket,
    socketEventName: raw.socketEventName,
    userId: raw.userId,
  };
};

export const useFeatureFlags = (
  api: FlagsApi,
  basePathOrOptions?: string | UseFeatureFlagsOptions
): UseFeatureFlagsResult => {
  const {basePath, domain, skip, socket, socketEventName, userId} =
    resolveFeatureFlagsOptions(basePathOrOptions);

  const {
    client,
    error,
    flags: rawFlags,
    isLoading,
    refetch,
  } = useTerrenoFeatureFlags(api, {
    basePath,
    domain,
    skip,
    socket,
    socketEventName,
    userId,
  });

  const fetchStartedAtRef = useRef<number | null>(null);

  useEffect((): void => {
    if (!isLoading || fetchStartedAtRef.current !== null) {
      return;
    }

    fetchStartedAtRef.current = DateTime.now().toMillis();
    console.debug("[feature-flags] flagConfiguration request started", {
      basePath,
    });
  }, [basePath, isLoading]);

  useEffect((): void => {
    if (!error || fetchStartedAtRef.current === null) {
      return;
    }

    const durationMs = DateTime.now().toMillis() - fetchStartedAtRef.current;
    fetchStartedAtRef.current = null;
    console.debug("[feature-flags] flagConfiguration request failed", {
      basePath,
      durationMs,
      error,
    });
  }, [basePath, error]);

  const flatFlags = useMemo((): FlagValues => {
    const out: FlagValues = {};
    for (const [key, def] of Object.entries(rawFlags)) {
      const value = def.variants[def.defaultVariant];
      out[key] = value ?? null;
    }
    return out;
  }, [rawFlags]);

  useEffect((): void => {
    if (Object.keys(flatFlags).length === 0 || fetchStartedAtRef.current === null) {
      return;
    }

    if (isLoading) {
      return;
    }

    const durationMs = DateTime.now().toMillis() - fetchStartedAtRef.current;
    fetchStartedAtRef.current = null;
    console.debug("[feature-flags] flagConfiguration request completed", {
      basePath,
      durationMs,
      evaluatedFlagCount: Object.keys(flatFlags).length,
      evaluatedFlags: flatFlags,
    });
  }, [basePath, flatFlags, isLoading]);

  const getFlag = useCallback(
    (key: string): boolean => {
      return client.getBooleanValue(key, false);
    },
    [client]
  );

  const getVariant = useCallback(
    (key: string): string | null => {
      if (!rawFlags[key]) {
        return null;
      }
      const value = client.getStringValue(key, "");
      if (value === "") {
        return null;
      }
      return value;
    },
    [client, rawFlags]
  );

  const stableRefetch = useCallback((): void => {
    void refetch();
  }, [refetch]);

  return {error, flags: flatFlags, getFlag, getVariant, isLoading, refetch: stableRefetch};
};
