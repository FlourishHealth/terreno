export interface SubmitConsentBody {
  agreed: boolean;
  checkboxValues?: Record<string, boolean>;
  consentFormId: string;
  locale: string;
  signature?: string;
}

interface SubmitConsentMutationResult {
  unwrap: () => Promise<unknown>;
}

interface SubmitConsentMutationHookState {
  error: unknown;
  isLoading: boolean;
}

interface SubmitConsentMutationBuilder {
  mutation: (options: {
    invalidatesTags: string[];
    query: (body: SubmitConsentBody) => {
      body: SubmitConsentBody;
      method: "POST";
      url: string;
    };
  }) => unknown;
}

interface SubmitConsentEnhancedApi {
  useSubmitConsentResponseMutation: () => [
    (body: SubmitConsentBody) => SubmitConsentMutationResult,
    SubmitConsentMutationHookState,
  ];
}

interface SubmitConsentApiWithTags {
  injectEndpoints: (options: {
    endpoints: (build: SubmitConsentMutationBuilder) => {submitConsentResponse: unknown};
    overrideExisting: boolean;
  }) => SubmitConsentEnhancedApi;
}

interface SubmitConsentApi {
  enhanceEndpoints: (options: {addTagTypes: string[]}) => SubmitConsentApiWithTags;
}

/**
 * Cache the enhanced api per (api, baseUrl). `injectEndpoints` logs a console
 * error in development whenever an endpoint with the same name is re-injected
 * (with `overrideExisting: false`), so calling it on every render of every
 * consumer would flood the console. WeakMap-by-api lets the GC reclaim entries
 * when the api object is unreachable.
 */
const enhancedApiCache = new WeakMap<SubmitConsentApi, Map<string, SubmitConsentEnhancedApi>>();

const getEnhancedApi = (api: SubmitConsentApi, base: string): SubmitConsentEnhancedApi => {
  let byBase = enhancedApiCache.get(api);
  if (!byBase) {
    byBase = new Map();
    enhancedApiCache.set(api, byBase);
  }
  const cached = byBase.get(base);
  if (cached) {
    return cached;
  }
  const apiWithConsentTags = api.enhanceEndpoints({addTagTypes: ["PendingConsents"]});
  const enhanced = apiWithConsentTags.injectEndpoints({
    endpoints: (build) => ({
      submitConsentResponse: build.mutation({
        invalidatesTags: ["PendingConsents"],
        query: (body: SubmitConsentBody) => ({
          body,
          method: "POST",
          url: `${base}/consents/respond`,
        }),
      }),
    }),
    overrideExisting: false,
  });
  byBase.set(base, enhanced);
  return enhanced;
};

export const useSubmitConsent = (api: SubmitConsentApi, baseUrl?: string) => {
  const base = baseUrl || "";
  const enhancedApi = getEnhancedApi(api, base);

  const [submitMutation, {isLoading: isSubmitting, error}] =
    enhancedApi.useSubmitConsentResponseMutation();

  const submit = async (body: SubmitConsentBody) => {
    return submitMutation(body).unwrap();
  };

  return {error, isSubmitting, submit};
};
