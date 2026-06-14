import {NOOP_PROVIDER, OpenFeature, TypedInMemoryProvider} from "@openfeature/web-sdk";
import type {Api} from "@reduxjs/toolkit/query/react";
import {useCallback, useEffect, useMemo, useState} from "react";

/** Shape returned by `GET .../flagConfiguration` (OpenFeature static flag map). */
export interface TerrenoFlagDefinition {
  defaultVariant: string;
  disabled: boolean;
  variants: Record<string, boolean | string>;
}

export type TerrenoFlagConfiguration = Record<string, TerrenoFlagDefinition>;

export interface UseTerrenoFeatureFlagsOptions {
  basePath?: string;
  skip?: boolean;
  /** Current user id — included in RTK cache key and OpenFeature targeting context. */
  userId?: string | null;
  /** Optional socket.io client for live flag refresh. */
  socket?: {
    off: (event: string, handler: (...args: unknown[]) => void) => void;
    on: (event: string, handler: (...args: unknown[]) => void) => void;
  } | null;
  socketEventName?: string;
  /** OpenFeature domain — must match `<OpenFeatureProvider domain>` on the client. */
  domain?: string;
}

export interface UseTerrenoFeatureFlagsResult {
  client: ReturnType<typeof OpenFeature.getClient>;
  error: unknown;
  flags: TerrenoFlagConfiguration;
  isLoading: boolean;
  refetch: () => unknown;
}

// biome-ignore lint/suspicious/noExplicitAny: RTK Query API generic typing is intentionally flexible here.
type FlagsApi = Api<any, any, any, any>;

// biome-ignore lint/suspicious/noExplicitAny: Endpoint hook is injected dynamically by RTK Query.
type EnhancedTerrenoFlagsApi = FlagsApi & {useTerrenoFlagConfigurationQuery: any};

const enhancedApiCache = new WeakMap<FlagsApi, Map<string, EnhancedTerrenoFlagsApi>>();

const getEnhancedApi = (api: FlagsApi, basePath: string): EnhancedTerrenoFlagsApi => {
  let byBase = enhancedApiCache.get(api);
  if (!byBase) {
    byBase = new Map();
    enhancedApiCache.set(api, byBase);
  }
  const cached = byBase.get(basePath);
  if (cached) {
    return cached;
  }
  const enhanced = api.injectEndpoints({
    endpoints: (builder) => ({
      terrenoFlagConfiguration: builder.query<TerrenoFlagConfiguration, {cacheKey: string}>({
        providesTags: (_result, _err, arg) => [{id: arg.cacheKey, type: "feature-flags"}],
        query: () => ({
          method: "GET",
          url: `${basePath}/flagConfiguration`,
        }),
      }),
    }),
    overrideExisting: false,
  }) as EnhancedTerrenoFlagsApi;
  byBase.set(basePath, enhanced);
  return enhanced;
};

let terrenoOpenFeatureHookRefCount = 0;

/** Last in-flight `setProviderAndWait` per OpenFeature domain (shared across hook instances). */
const domainProviderSwitchPromises = new Map<string, Promise<void>>();

/**
 * Wires Terreno's bulk `/flagConfiguration` fetch into OpenFeature's
 * {@link TypedInMemoryProvider} for the given domain. Prefer OpenFeature React
 * hooks (`useBooleanFlagValue`, etc.) as children of `<OpenFeatureProvider>`.
 */
export const useTerrenoFeatureFlags = (
  api: FlagsApi,
  options?: UseTerrenoFeatureFlagsOptions
): UseTerrenoFeatureFlagsResult => {
  const basePath = options?.basePath ?? "/feature-flags";
  const domain = options?.domain ?? "feature-flags";
  const userId = options?.userId ?? null;
  const skip = options?.skip === true;
  const socket = options?.socket ?? null;
  const socketEventName = options?.socketEventName ?? "featureFlagsChanged";

  const enhancedApi = useMemo(() => getEnhancedApi(api, basePath), [api, basePath]);
  const useTerrenoFlagConfigurationQuery = enhancedApi.useTerrenoFlagConfigurationQuery;
  const {
    data,
    error,
    isFetching,
    isLoading: isQueryLoading,
    isSuccess,
    refetch,
  } = useTerrenoFlagConfigurationQuery({cacheKey: userId ?? ""}, {skip});

  const [providerReady, setProviderReady] = useState<boolean>(skip);
  const client = useMemo(() => OpenFeature.getClient(domain), [domain]);

  useEffect(() => {
    terrenoOpenFeatureHookRefCount += 1;
    return (): void => {
      terrenoOpenFeatureHookRefCount -= 1;
      if (terrenoOpenFeatureHookRefCount <= 0) {
        terrenoOpenFeatureHookRefCount = 0;
        void (async (): Promise<void> => {
          const pending = domainProviderSwitchPromises.get(domain);
          if (pending) {
            await pending;
          }
          await OpenFeature.setProviderAndWait(domain, NOOP_PROVIDER);
        })();
      }
    };
  }, [domain]);

  useEffect((): void => {
    if (skip) {
      return;
    }
    void OpenFeature.setContext(domain, {targetingKey: userId ?? ""});
  }, [domain, skip, userId]);

  useEffect((): void => {
    if (skip) {
      setProviderReady(true);
      return;
    }
    setProviderReady(false);
  }, [skip, userId]);

  useEffect(() => {
    if (skip || !isSuccess || !data) {
      return;
    }

    let cancelled = false;

    const applyProvider = async (): Promise<void> => {
      const pending = domainProviderSwitchPromises.get(domain);
      const run = (async (): Promise<void> => {
        if (pending) {
          await pending;
        }
        await OpenFeature.setProviderAndWait(domain, new TypedInMemoryProvider(data));
      })();
      domainProviderSwitchPromises.set(domain, run);
      try {
        await run;
      } finally {
        if (domainProviderSwitchPromises.get(domain) === run) {
          domainProviderSwitchPromises.delete(domain);
        }
      }
      if (!cancelled) {
        setProviderReady(true);
      }
    };

    void applyProvider();

    return (): void => {
      cancelled = true;
    };
  }, [data, domain, isSuccess, skip]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handler = (): void => {
      void refetch();
    };

    socket.on(socketEventName, handler);
    return (): void => {
      socket.off(socketEventName, handler);
    };
  }, [refetch, socket, socketEventName]);

  const flags = data ?? {};

  const isLoading = useMemo((): boolean => {
    if (skip) {
      return false;
    }
    if (!isSuccess || !data) {
      return true;
    }
    if (isQueryLoading || isFetching) {
      return true;
    }
    if (!providerReady) {
      return true;
    }
    return false;
  }, [data, isFetching, isQueryLoading, isSuccess, providerReady, skip]);

  const stableRefetch = useCallback((): unknown => {
    return refetch();
  }, [refetch]);

  return {
    client,
    error,
    flags,
    isLoading,
    refetch: stableRefetch,
  };
};
