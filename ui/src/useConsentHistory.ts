export interface ConsentHistoryEntry {
  _id: string;
  agreed: boolean;
  agreedAt: string;
  checkboxValues?: Record<string, boolean>;
  contentSnapshot?: string;
  form: {
    captureSignature: boolean;
    checkboxes: Array<{label: string; required: boolean; confirmationPrompt?: string}>;
    slug: string;
    title: string;
    type: string;
    version: number;
  } | null;
  formVersionSnapshot?: number;
  ipAddress?: string;
  locale?: string;
  signature?: string;
  signedAt?: string;
  userAgent?: string;
}

interface ConsentHistoryResponse {
  data?: ConsentHistoryEntry[];
}

interface ConsentHistoryQueryBuilder {
  query: (options: {providesTags: string[]; query: () => string}) => unknown;
}

interface ConsentHistoryHookState {
  data?: ConsentHistoryEntry[] | ConsentHistoryResponse;
  error: unknown;
  isLoading: boolean;
  refetch: () => void | Promise<void>;
}

interface ConsentHistoryEnhancedApi {
  useGetMyConsentsQuery: () => ConsentHistoryHookState;
}

interface ConsentHistoryApi {
  enhanceEndpoints: (options: {addTagTypes: string[]}) => ConsentHistoryApi;
  injectEndpoints: (options: {
    endpoints: (build: ConsentHistoryQueryBuilder) => {getMyConsents: unknown};
    overrideExisting: boolean;
  }) => ConsentHistoryEnhancedApi;
}

/**
 * Cache the enhanced api per (api, baseUrl). `injectEndpoints` logs a console
 * error in development whenever an endpoint with the same name is re-injected
 * (with `overrideExisting: false`), so calling it on every render of every
 * consumer would flood the console. WeakMap-by-api lets the GC reclaim entries
 * when the api object is unreachable.
 */
const enhancedApiCache = new WeakMap<ConsentHistoryApi, Map<string, ConsentHistoryEnhancedApi>>();

const getEnhancedApi = (api: ConsentHistoryApi, base: string): ConsentHistoryEnhancedApi => {
  let byBase = enhancedApiCache.get(api);
  if (!byBase) {
    byBase = new Map();
    enhancedApiCache.set(api, byBase);
  }
  const cached = byBase.get(base);
  if (cached) {
    return cached;
  }
  const enhanced = api.enhanceEndpoints({addTagTypes: ["MyConsents"]}).injectEndpoints({
    endpoints: (build) => ({
      getMyConsents: build.query({
        providesTags: ["MyConsents"],
        query: () => `${base}/consents/my`,
      }),
    }),
    overrideExisting: false,
  });
  byBase.set(base, enhanced);
  return enhanced;
};

export const useConsentHistory = (api: ConsentHistoryApi, baseUrl?: string) => {
  const base = baseUrl || "";
  const enhancedApi = getEnhancedApi(api, base);

  const {data, isLoading, error, refetch} = enhancedApi.useGetMyConsentsQuery();
  const entries: ConsentHistoryEntry[] = Array.isArray(data) ? data : (data?.data ?? []);

  return {entries, error, isLoading, refetch};
};
