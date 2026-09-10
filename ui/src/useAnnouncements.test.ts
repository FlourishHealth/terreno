import {describe, expect, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";

import {useAnnouncements} from "./useAnnouncements";

type AnnouncementsApi = Parameters<typeof useAnnouncements>[0];

interface MockQueryDef {
  query: (args?: {page?: number; limit?: number}) => string;
}

interface MockInjectOpts {
  endpoints: (build: {query: (def: MockQueryDef) => string}) => Record<string, unknown>;
}

describe("useAnnouncements", () => {
  const buildApi = ({
    feedData,
    pendingData,
    feedError,
    pendingError,
  }: {
    feedData?: unknown;
    pendingData?: unknown;
    feedError?: unknown;
    pendingError?: unknown;
  }) => {
    const refetchPending = mock(() => Promise.resolve());
    const refetchFeed = mock(() => Promise.resolve());
    const useGetPendingAnnouncementsQuery = mock(() => ({
      data: pendingData,
      error: pendingError,
      isLoading: false,
      refetch: refetchPending,
    }));
    const useGetAnnouncementFeedQuery = mock(() => ({
      data: feedData,
      error: feedError,
      isLoading: false,
      refetch: refetchFeed,
    }));
    const api = {
      enhanceEndpoints: mock(() => ({
        injectEndpoints: mock((opts: MockInjectOpts) => {
          const build = {
            query: mock((def: MockQueryDef) => {
              const pendingUrl = def.query();
              const feedUrl = def.query({limit: 5, page: 2});
              expect(
                pendingUrl.includes("/announcements/pending") ||
                  feedUrl.includes("/announcements/feed")
              ).toBe(true);
              return "query";
            }),
          };
          opts.endpoints(build);
          return {useGetAnnouncementFeedQuery, useGetPendingAnnouncementsQuery};
        }),
      })),
    };
    return {api, refetchFeed, refetchPending};
  };

  it("unwraps pending and feed payloads", () => {
    const {api} = buildApi({
      feedData: {
        data: [
          {
            body: "Body",
            id: "feed-1",
            priority: 0,
            requiresAcknowledgement: false,
            title: "Feed",
            version: 1,
          },
        ],
      },
      pendingData: {data: {current: null, remainingCount: 0}},
    });
    const {result} = renderHook(() => useAnnouncements(api as unknown as AnnouncementsApi, "/api"));
    expect(result.current.pending?.remainingCount).toBe(0);
    expect(result.current.feed).toHaveLength(1);
    expect(result.current.feed[0]?.id).toBe("feed-1");
  });

  it("surfaces pending errors without treating feed errors as blocking", () => {
    const {api} = buildApi({
      feedError: new Error("feed failed"),
      pendingError: new Error("pending failed"),
    });
    const {result} = renderHook(() => useAnnouncements(api as unknown as AnnouncementsApi));
    expect(result.current.error).toEqual(new Error("pending failed"));
    expect(result.current.feedError).toEqual(new Error("feed failed"));
  });

  it("keeps feed errors separate from pending errors", () => {
    const {api} = buildApi({
      feedError: new Error("feed failed"),
      pendingData: {data: {current: null, remainingCount: 0}},
    });
    const {result} = renderHook(() => useAnnouncements(api as unknown as AnnouncementsApi));
    expect(result.current.error).toBeUndefined();
    expect(result.current.feedError).toEqual(new Error("feed failed"));
  });

  it("caches enhanced api per base url", () => {
    let injectCount = 0;
    const api = {
      enhanceEndpoints: () => ({
        injectEndpoints: () => {
          injectCount += 1;
          return {
            useGetAnnouncementFeedQuery: () => ({
              data: [],
              error: undefined,
              isLoading: false,
              refetch: () => Promise.resolve(),
            }),
            useGetPendingAnnouncementsQuery: () => ({
              data: undefined,
              error: undefined,
              isLoading: false,
              refetch: () => Promise.resolve(),
            }),
          };
        },
      }),
    };
    const {rerender} = renderHook(() =>
      useAnnouncements(api as unknown as AnnouncementsApi, "/api")
    );
    rerender(undefined);
    expect(injectCount).toBe(1);
  });
});
