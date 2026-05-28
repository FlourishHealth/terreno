import {describe, expect, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";

import type {ConsentHistoryEntry} from "./useConsentHistory";
import {useConsentHistory} from "./useConsentHistory";

type ConsentHistoryApi = Parameters<typeof useConsentHistory>[0];

interface MockQueryDef {
  query: () => string;
  providesTags: string[];
}

interface MockInjectOpts {
  endpoints: (build: {query: (def: MockQueryDef) => string}) => Record<string, unknown>;
}

describe("useConsentHistory", () => {
  const buildApi = (queryResult: {data?: unknown; error?: unknown; isLoading?: boolean}) => {
    const refetch = mock(() => {});
    const useGetMyConsentsQuery = mock(() => ({
      data: queryResult.data,
      error: queryResult.error,
      isLoading: queryResult.isLoading ?? false,
      refetch,
    }));
    const injectEndpoints = mock((opts: MockInjectOpts) => {
      const build = {
        query: mock((def: MockQueryDef) => {
          // Exercise the URL builder so the closure captures `base`
          const url = def.query();
          expect(url).toContain("/consents/my");
          return "my-consents-query";
        }),
      };
      opts.endpoints(build);
      return {useGetMyConsentsQuery};
    });
    const api = {
      enhanceEndpoints: mock(() => api),
      injectEndpoints,
    };
    return {api, refetch};
  };

  it("returns an array of entries when response is an array", () => {
    const {api} = buildApi({
      data: [{_id: "1", agreed: true} as unknown as ConsentHistoryEntry],
    });
    const {result} = renderHook(() => useConsentHistory(api as unknown as ConsentHistoryApi));
    expect(Array.isArray(result.current.entries)).toBe(true);
    expect(result.current.entries).toHaveLength(1);
  });

  it("unwraps .data property when response is object shape", () => {
    const {api} = buildApi({
      data: {data: [{_id: "2", agreed: false} as unknown as ConsentHistoryEntry]},
    });
    const {result} = renderHook(() =>
      useConsentHistory(api as unknown as ConsentHistoryApi, "/api")
    );
    expect(Array.isArray(result.current.entries)).toBe(true);
    expect(result.current.entries).toHaveLength(1);
  });

  it("returns empty array when no data is present", () => {
    const {api} = buildApi({data: undefined, isLoading: true});
    const {result} = renderHook(() => useConsentHistory(api as unknown as ConsentHistoryApi));
    expect(result.current.entries).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it("surfaces error from the query hook", () => {
    const {api} = buildApi({data: undefined, error: "boom"});
    const {result} = renderHook(() => useConsentHistory(api as unknown as ConsentHistoryApi));
    expect(result.current.error).toBe("boom");
  });

  it("injects the my-consents endpoint only once per (api, baseUrl)", () => {
    let injectCallCount = 0;
    const refetch = mock(() => {});
    const useGetMyConsentsQuery = mock(() => ({
      data: undefined,
      error: undefined,
      isLoading: false,
      refetch,
    }));
    const api = {
      enhanceEndpoints: () => api,
      injectEndpoints: () => {
        injectCallCount += 1;
        return {useGetMyConsentsQuery};
      },
    };
    const {rerender} = renderHook(() => useConsentHistory(api as unknown as ConsentHistoryApi));
    rerender(undefined);
    rerender(undefined);
    // The hook reuses the cached enhanced api after the first render so the
    // dev-mode RTK warning about re-injecting endpoints never fires.
    expect(injectCallCount).toBe(1);
  });
});
