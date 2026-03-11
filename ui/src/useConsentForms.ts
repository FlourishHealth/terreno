export interface ConsentFormPublic {
  id: string;
  title: string;
  slug: string;
  version: number;
  order: number;
  type: string;
  content: Record<string, string>;
  defaultLocale: string;
  active: boolean;
  captureSignature: boolean;
  requireScrollToBottom: boolean;
  checkboxes: Array<{label: string; required: boolean; confirmationPrompt?: string}>;
  agreeButtonText: string;
  allowDecline: boolean;
  declineButtonText: string;
  required: boolean;
}

export const detectLocale = (): string => {
  // Web
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }

  // expo-localization (native), guarded with try/catch in case it's unavailable
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Localization = require("expo-localization");
    const locale: string | undefined =
      Localization?.getLocales?.()[0]?.languageTag ?? Localization?.locale;
    if (locale) {
      return locale;
    }
  } catch {
    // expo-localization not available in this environment
  }

  return "en";
};

export const useConsentForms = (api: any, baseUrl?: string) => {
  const base = baseUrl || "";

  const enhancedApi = api.injectEndpoints({
    endpoints: (build: any) => ({
      getPendingConsents: build.query({
        providesTags: ["PendingConsents"],
        query: () => `${base}/consents/pending`,
      }),
    }),
    overrideExisting: false,
  });

  const {data, isLoading, error, refetch} = enhancedApi.useGetPendingConsentsQuery();
  const forms: ConsentFormPublic[] = data?.data ?? [];

  return {error, forms, isLoading, refetch};
};
