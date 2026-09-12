import {getAnnouncementPlatform} from "./announcementPlatform";

export interface AnnouncementPublic {
  id: string;
  title: string;
  body: string;
  version: number;
  priority: number;
  requiresAcknowledgement: boolean;
  primaryAction?: {
    label: string;
    url: string;
  };
  publishedAt?: string;
}

export interface PendingAnnouncementsResponse {
  current: AnnouncementPublic | null;
  remainingCount: number;
}

interface AnnouncementsResponse<T> {
  data?: T;
}

interface AnnouncementsQueryBuilder {
  query: (options: {
    providesTags?: string[];
    query: (args?: {page?: number; limit?: number}) => string;
  }) => unknown;
}

interface AnnouncementsHookState<T> {
  data?: T | AnnouncementsResponse<T>;
  error: unknown;
  isLoading: boolean;
  refetch: () => void | Promise<void>;
}

interface AnnouncementsEnhancedApi {
  useGetPendingAnnouncementsQuery: () => AnnouncementsHookState<PendingAnnouncementsResponse>;
  useGetAnnouncementFeedQuery: (args?: {
    page?: number;
    limit?: number;
  }) => AnnouncementsHookState<AnnouncementPublic[]>;
}

interface AnnouncementsApiWithTags {
  injectEndpoints: (options: {
    endpoints: (build: AnnouncementsQueryBuilder) => {
      getAnnouncementFeed: unknown;
      getPendingAnnouncements: unknown;
    };
    overrideExisting: boolean;
  }) => AnnouncementsEnhancedApi;
}

interface AnnouncementsApi {
  enhanceEndpoints: (options: {addTagTypes: string[]}) => AnnouncementsApiWithTags;
}

const enhancedApiCache = new WeakMap<AnnouncementsApi, Map<string, AnnouncementsEnhancedApi>>();

const getEnhancedApi = (api: AnnouncementsApi, base: string): AnnouncementsEnhancedApi => {
  let byBase = enhancedApiCache.get(api);
  if (!byBase) {
    byBase = new Map();
    enhancedApiCache.set(api, byBase);
  }
  const cached = byBase.get(base);
  if (cached) {
    return cached;
  }
  const apiWithTags = api.enhanceEndpoints({
    addTagTypes: ["PendingAnnouncements", "AnnouncementFeed"],
  });
  const enhanced = apiWithTags.injectEndpoints({
    endpoints: (build) => ({
      getAnnouncementFeed: build.query({
        providesTags: ["AnnouncementFeed"],
        query: (args?: {page?: number; limit?: number}) => {
          const page = args?.page ?? 1;
          const limit = args?.limit ?? 20;
          const platform = getAnnouncementPlatform();
          return `${base}/announcements/feed?page=${page}&limit=${limit}&platform=${platform}`;
        },
      }),
      getPendingAnnouncements: build.query({
        providesTags: ["PendingAnnouncements"],
        query: () => {
          const platform = getAnnouncementPlatform();
          return `${base}/announcements/pending?platform=${platform}`;
        },
      }),
    }),
    overrideExisting: false,
  });
  byBase.set(base, enhanced);
  return enhanced;
};

export const useAnnouncements = (
  api: AnnouncementsApi,
  baseUrl?: string,
  feedOptions?: {page?: number; limit?: number}
) => {
  const base = baseUrl || "";
  const enhancedApi = getEnhancedApi(api, base);
  const {
    data: pendingData,
    isLoading: isPendingLoading,
    error: pendingError,
    refetch: refetchPending,
  } = enhancedApi.useGetPendingAnnouncementsQuery();
  const {
    data: feedData,
    isLoading: isFeedLoading,
    error: feedError,
    refetch: refetchFeed,
  } = enhancedApi.useGetAnnouncementFeedQuery(feedOptions);

  const pendingPayload =
    (pendingData as AnnouncementsResponse<PendingAnnouncementsResponse> | undefined)?.data ??
    (pendingData as PendingAnnouncementsResponse | undefined);
  const feedPayload =
    (feedData as AnnouncementsResponse<AnnouncementPublic[]> | undefined)?.data ??
    (feedData as AnnouncementPublic[] | undefined) ??
    [];

  return {
    error: pendingError,
    feed: feedPayload,
    feedError,
    isFeedLoading,
    isLoading: isPendingLoading,
    isPendingLoading,
    pending: pendingPayload,
    refetch: refetchPending,
    refetchFeed,
  };
};
