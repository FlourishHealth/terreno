import {describe, expect, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";
import {useJobsDashboardApi} from "../jobs/useJobsDashboardApi";
import type {AdminApi, EndpointBuilder} from "../types";

interface CapturedEndpoint {
  invalidatesTags?: string[];
  providesTags?: unknown;
  query: (arg: never) => {method: string; params?: Record<string, unknown>; url: string};
}

const makeMockApi = () => {
  const injected: Record<string, CapturedEndpoint> = {};
  const enhancedTagTypes: string[] = [];

  const apiProxy: Record<string, unknown> = {
    enhanceEndpoints: ({addTagTypes}: {addTagTypes: string[]}) => {
      enhancedTagTypes.push(...addTagTypes);
      return apiProxy;
    },
    injectEndpoints: ({
      endpoints,
    }: {
      endpoints: (build: unknown) => Record<string, CapturedEndpoint>;
    }) => {
      const build = {
        mutation: (spec: CapturedEndpoint) => spec,
        query: (spec: CapturedEndpoint) => spec,
      };
      Object.assign(injected, endpoints(build as EndpointBuilder));
      return {
        useJobsDashboardCancelMutation: mock(() => [mock(() => ({})), {isLoading: false}]),
        useJobsDashboardDetailQuery: mock(() => ({isLoading: false})),
        useJobsDashboardListQuery: mock(() => ({isLoading: false})),
        useJobsDashboardPauseScheduleMutation: mock(() => [mock(() => ({})), {isLoading: false}]),
        useJobsDashboardRequeueMutation: mock(() => [mock(() => ({})), {isLoading: false}]),
        useJobsDashboardResumeScheduleMutation: mock(() => [mock(() => ({})), {isLoading: false}]),
        useJobsDashboardRetryMutation: mock(() => [mock(() => ({})), {isLoading: false}]),
        useJobsDashboardSchedulesQuery: mock(() => ({isLoading: false})),
        useJobsDashboardStatsQuery: mock(() => ({isLoading: false})),
      };
    },
  };

  return {api: apiProxy as AdminApi, enhancedTagTypes, injected};
};

describe("useJobsDashboardApi isolated", () => {
  it("registers jobs admin endpoints on the server /jobs path", () => {
    const {api, enhancedTagTypes, injected} = makeMockApi();
    renderHook(() => useJobsDashboardApi(api));

    expect(enhancedTagTypes).toEqual(["jobsAdmin"]);
    expect(injected.jobsDashboardList.query({} as never).url).toBe("/jobs");
    expect(injected.jobsDashboardDetail.query("abc" as never).url).toBe("/jobs/abc");
    expect(injected.jobsDashboardSchedules.query(undefined as never).url).toBe("/jobs/schedules");
    expect(injected.jobsDashboardStats.query(undefined as never).url).toBe("/jobs/stats");
    expect(injected.jobsDashboardRetry.invalidatesTags).toEqual(["jobsAdmin"]);
  });
});
