export interface SubmitConsentBody {
  agreed: boolean;
  checkboxValues?: Record<string, boolean>;
  consentFormId: string;
  locale: string;
  signature?: string;
}

export const useSubmitConsent = (api: any, baseUrl?: string) => {
  const base = baseUrl || "";
  const apiWithConsentTags = api.enhanceEndpoints({addTagTypes: ["PendingConsents"]});

  const enhancedApi = apiWithConsentTags.injectEndpoints({
    endpoints: (build: any) => ({
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
