interface AcknowledgeAnnouncementMutationResult {
  unwrap: () => Promise<unknown>;
}

interface AcknowledgeAnnouncementMutationHookState {
  error: unknown;
  isLoading: boolean;
}

interface AcknowledgeAnnouncementMutationBuilder {
  mutation: (options: {
    invalidatesTags: string[];
    query: (args: {announcementId: string; platform?: string}) => {
      body?: {platform?: string};
      method: "POST";
      url: string;
    };
  }) => unknown;
}

interface AcknowledgeAnnouncementEnhancedApi {
  useAcknowledgeAnnouncementMutation: () => [
    (args: {announcementId: string; platform?: string}) => AcknowledgeAnnouncementMutationResult,
    AcknowledgeAnnouncementMutationHookState,
  ];
  useRecordAnnouncementImpressionMutation: () => [
    (args: {announcementId: string; platform?: string}) => AcknowledgeAnnouncementMutationResult,
    AcknowledgeAnnouncementMutationHookState,
  ];
}

interface AcknowledgeAnnouncementApiWithTags {
  injectEndpoints: (options: {
    endpoints: (build: AcknowledgeAnnouncementMutationBuilder) => {
      acknowledgeAnnouncement: unknown;
      recordAnnouncementImpression: unknown;
    };
    overrideExisting: boolean;
  }) => AcknowledgeAnnouncementEnhancedApi;
}

interface AcknowledgeAnnouncementApi {
  enhanceEndpoints: (options: {addTagTypes: string[]}) => AcknowledgeAnnouncementApiWithTags;
}

const enhancedApiCache = new WeakMap<
  AcknowledgeAnnouncementApi,
  Map<string, AcknowledgeAnnouncementEnhancedApi>
>();

const getEnhancedApi = (
  api: AcknowledgeAnnouncementApi,
  base: string
): AcknowledgeAnnouncementEnhancedApi => {
  let byBase = enhancedApiCache.get(api);
  if (!byBase) {
    byBase = new Map();
    enhancedApiCache.set(api, byBase);
  }
  const cached = byBase.get(base);
  if (cached) {
    return cached;
  }
  const apiWithTags = api.enhanceEndpoints({addTagTypes: ["PendingAnnouncements"]});
  const enhanced = apiWithTags.injectEndpoints({
    endpoints: (build) => ({
      acknowledgeAnnouncement: build.mutation({
        invalidatesTags: ["PendingAnnouncements"],
        query: ({announcementId}: {announcementId: string}) => ({
          method: "POST",
          url: `${base}/announcements/${announcementId}/acknowledge`,
        }),
      }),
      recordAnnouncementImpression: build.mutation({
        invalidatesTags: [],
        query: ({announcementId, platform}: {announcementId: string; platform?: string}) => ({
          body: platform ? {platform} : undefined,
          method: "POST",
          url: `${base}/announcements/${announcementId}/impression`,
        }),
      }),
    }),
    overrideExisting: false,
  });
  byBase.set(base, enhanced);
  return enhanced;
};

export const useAcknowledgeAnnouncement = (api: AcknowledgeAnnouncementApi, baseUrl?: string) => {
  const base = baseUrl || "";
  const enhancedApi = getEnhancedApi(api, base);

  const [acknowledgeMutation, {isLoading: isAcknowledging, error: acknowledgeError}] =
    enhancedApi.useAcknowledgeAnnouncementMutation();
  const [impressionMutation, {isLoading: isRecordingImpression, error: impressionError}] =
    enhancedApi.useRecordAnnouncementImpressionMutation();

  const acknowledge = async (announcementId: string): Promise<void> => {
    await acknowledgeMutation({announcementId}).unwrap();
  };

  const recordImpression = async (announcementId: string, platform = "web"): Promise<void> => {
    await impressionMutation({announcementId, platform}).unwrap();
  };

  return {
    acknowledge,
    error: acknowledgeError ?? impressionError,
    isAcknowledging,
    isRecordingImpression,
    isSubmitting: isAcknowledging || isRecordingImpression,
    recordImpression,
  };
};
