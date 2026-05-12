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

interface SubmitConsentApiWithTags {
  injectEndpoints: (options: {
    endpoints: (build: SubmitConsentMutationBuilder) => {submitConsentResponse: unknown};
    overrideExisting: boolean;
  }) => {
    useSubmitConsentResponseMutation: () => [
      (body: SubmitConsentBody) => SubmitConsentMutationResult,
      SubmitConsentMutationHookState,
    ];
  };
}

interface SubmitConsentApi {
  enhanceEndpoints: (options: {addTagTypes: string[]}) => SubmitConsentApiWithTags;
}

export const useSubmitConsent = (api: SubmitConsentApi, baseUrl?: string) => {
  const base = baseUrl || "";
  const apiWithConsentTags = api.enhanceEndpoints({addTagTypes: ["PendingConsents"]});

  const enhancedApi = apiWithConsentTags.injectEndpoints({
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

  const [submitMutation, {isLoading: isSubmitting, error}] =
    enhancedApi.useSubmitConsentResponseMutation();

  const submit = async (body: SubmitConsentBody) => {
    return submitMutation(body).unwrap();
  };

  return {error, isSubmitting, submit};
};
