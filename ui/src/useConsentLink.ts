import type {ConsentFormPublic} from "./useConsentForms";
import type {SubmitConsentBody} from "./useSubmitConsent";

export interface ConsentLinkContext {
  expiresAt?: string;
  formCount?: number;
  name?: string;
}

export interface ConsentLinkPayload {
  context?: ConsentLinkContext;
  forms: ConsentFormPublic[];
}

interface ConsentLinkResponse {
  data?: ConsentLinkPayload;
}

// Body for submitting via a link — same as a normal consent response, without the token.
export type SubmitConsentViaLinkBody = SubmitConsentBody;

interface ConsentLinkQueryState {
  data?: ConsentLinkPayload | ConsentLinkResponse;
  error: unknown;
  isLoading: boolean;
  refetch: () => void | Promise<void>;
}

interface ConsentLinkSubmitResult {
  unwrap: () => Promise<unknown>;
}

interface ConsentLinkEnhancedApi {
  useGetConsentLinkQuery: (token: string, options?: {skip?: boolean}) => ConsentLinkQueryState;
  useSubmitConsentViaLinkMutation: () => [
    (args: {body: SubmitConsentViaLinkBody; token: string}) => ConsentLinkSubmitResult,
    {error: unknown; isLoading: boolean},
  ];
}

interface ConsentLinkQueryBuilder {
  mutation: (options: {
    invalidatesTags?: string[];
    query: (args: {body: SubmitConsentViaLinkBody; token: string}) => {
      body: SubmitConsentViaLinkBody;
      method: "POST";
      url: string;
    };
  }) => unknown;
  query: (options: {providesTags: string[]; query: (token: string) => string}) => unknown;
}

interface ConsentLinkApiWithTags {
  injectEndpoints: (options: {
    endpoints: (build: ConsentLinkQueryBuilder) => {
      getConsentLink: unknown;
      submitConsentViaLink: unknown;
    };
    overrideExisting: boolean;
  }) => ConsentLinkEnhancedApi;
}

interface ConsentLinkApi {
  enhanceEndpoints: (options: {addTagTypes: string[]}) => ConsentLinkApiWithTags;
}

/**
 * Cache the enhanced api per (api, baseUrl) to avoid re-injecting endpoints on
 * every render (which logs a console error in development). Mirrors the pattern
 * in useConsentForms / useSubmitConsent.
 */
const enhancedApiCache = new WeakMap<ConsentLinkApi, Map<string, ConsentLinkEnhancedApi>>();

const getEnhancedApi = (api: ConsentLinkApi, base: string): ConsentLinkEnhancedApi => {
  let byBase = enhancedApiCache.get(api);
  if (!byBase) {
    byBase = new Map();
    enhancedApiCache.set(api, byBase);
  }
  const cached = byBase.get(base);
  if (cached) {
    return cached;
  }
  const apiWithTags = api.enhanceEndpoints({addTagTypes: ["ConsentLink"]});
  const enhanced = apiWithTags.injectEndpoints({
    endpoints: (build) => ({
      getConsentLink: build.query({
        providesTags: ["ConsentLink"],
        query: (token: string) => `${base}/consents/link/${token}`,
      }),
      submitConsentViaLink: build.mutation({
        // Intentionally does not invalidate the getConsentLink query: a single-use
        // link is consumed by this POST, so a refetch would 410. ConsentLinkScreen
        // advances through the forms it loaded up front instead.
        query: ({body, token}: {body: SubmitConsentViaLinkBody; token: string}) => ({
          body,
          method: "POST",
          url: `${base}/consents/link/${token}/respond`,
        }),
      }),
    }),
    overrideExisting: false,
  });
  byBase.set(base, enhanced);
  return enhanced;
};

const extractPayload = (
  data: ConsentLinkPayload | ConsentLinkResponse | undefined
): ConsentLinkPayload | undefined => {
  if (!data) {
    return undefined;
  }
  // The base query may or may not unwrap the `data` envelope.
  if ("forms" in data && Array.isArray((data as ConsentLinkPayload).forms)) {
    return data as ConsentLinkPayload;
  }
  return (data as ConsentLinkResponse).data;
};

/**
 * Loads and submits consent forms for a signed link token, without requiring an
 * authenticated session.
 */
export const useConsentLink = (
  // biome-ignore lint/suspicious/noExplicitAny: RTK Query api instance is a complex generic type
  api: any,
  token: string,
  baseUrl?: string
) => {
  const base = baseUrl || "";
  const enhancedApi = getEnhancedApi(api as ConsentLinkApi, base);

  const {data, isLoading, error, refetch} = enhancedApi.useGetConsentLinkQuery(token, {
    skip: !token,
  });
  const [submitMutation, {isLoading: isSubmitting, error: submitError}] =
    enhancedApi.useSubmitConsentViaLinkMutation();

  const payload = extractPayload(data);
  const forms: ConsentFormPublic[] = payload?.forms ?? [];
  const context = payload?.context;

  const submit = async (body: SubmitConsentViaLinkBody): Promise<unknown> => {
    return submitMutation({body, token}).unwrap();
  };

  return {context, error, forms, isLoading, isSubmitting, refetch, submit, submitError};
};
