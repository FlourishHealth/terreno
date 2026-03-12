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

import {getLocales} from "expo-localization";

export const detectLocale = (): string => {
  // Web
  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }

  // Native — expo-localization
  try {
    const locale = getLocales()[0]?.languageTag;
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
