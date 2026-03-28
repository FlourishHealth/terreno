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

export const useConsentHistory = (api: any, baseUrl?: string) => {
  const base = baseUrl || "";

  const enhancedApi = api.injectEndpoints({
    endpoints: (build: any) => ({
      getMyConsents: build.query({
        providesTags: ["MyConsents"],
        query: () => `${base}/consents/my`,
      }),
    }),
    overrideExisting: false,
  });

  const {data, isLoading, error, refetch} = enhancedApi.useGetMyConsentsQuery();
  const entries: ConsentHistoryEntry[] = Array.isArray(data) ? data : (data?.data ?? []);

  return {entries, error, isLoading, refetch};
};
