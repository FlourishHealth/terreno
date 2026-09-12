import {describe, expect, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";
import type {AdminApi, EndpointBuilder} from "../types";
import {jobRowId, unwrapJobRow} from "./jobPayload";
import {useJobsDashboardApi} from "./useJobsDashboardApi";

interface CapturedQuery {
  method: string;
  params?: Record<string, unknown>;
  url: string;
}

interface CapturedEndpoint {
  invalidatesTags?: string[];
  providesTags?: unknown;
  query: (arg: never) => CapturedQuery;
}

const createApiDouble = (): {
  addTagTypes: string[][];
  api: AdminApi;
  endpoints: Record<string, CapturedEndpoint>;
} => {
  const endpoints: Record<string, CapturedEndpoint> = {};
  const addTagTypes: string[][] = [];
  const api = {
    enhanceEndpoints: ({addTagTypes: tags}: {addTagTypes: string[]}) => {
      addTagTypes.push(tags);
      return api;
    },
    injectEndpoints: ({
      endpoints: build,
    }: {
      endpoints: (builder: EndpointBuilder) => Record<string, CapturedEndpoint>;
    }) => {
      const builder = {
        mutation: (spec: CapturedEndpoint) => spec,
        query: (spec: CapturedEndpoint) => spec,
      } as unknown as EndpointBuilder;
      Object.assign(endpoints, build(builder));
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
  } as unknown as AdminApi & {injectEndpoints: unknown};
  return {addTagTypes, api: api as AdminApi, endpoints};
};

describe("useJobsDashboardApi", () => {
  it("injects every dashboard endpoint against the /jobs base path", () => {
    const {addTagTypes, api, endpoints} = createApiDouble();
    const {result} = renderHook(() => useJobsDashboardApi(api));

    expect(addTagTypes[0]).toEqual(["jobsAdmin"]);
    expect(endpoints.jobsDashboardList.query({} as never)).toEqual({
      method: "GET",
      params: {},
      url: "/jobs",
    });
    expect(endpoints.jobsDashboardDetail.query("j1" as never)).toEqual({
      method: "GET",
      url: "/jobs/j1",
    });
    expect(endpoints.jobsDashboardSchedules.query(undefined as never)).toEqual({
      method: "GET",
      url: "/jobs/schedules",
    });
    expect(endpoints.jobsDashboardStats.query(undefined as never)).toEqual({
      method: "GET",
      url: "/jobs/stats",
    });
    expect(endpoints.jobsDashboardRetry.query("j1" as never)).toEqual({
      method: "POST",
      url: "/jobs/j1/retry",
    });
    expect(endpoints.jobsDashboardRequeue.query("j1" as never)).toEqual({
      method: "POST",
      url: "/jobs/j1/requeue",
    });
    expect(endpoints.jobsDashboardCancel.query("j1" as never)).toEqual({
      method: "POST",
      url: "/jobs/j1/cancel",
    });
    expect(endpoints.jobsDashboardPauseSchedule.query("nightly" as never)).toEqual({
      method: "POST",
      url: "/jobs/schedules/nightly/pause",
    });
    expect(endpoints.jobsDashboardResumeSchedule.query("nightly" as never)).toEqual({
      method: "POST",
      url: "/jobs/schedules/nightly/resume",
    });

    expect(typeof result.current.useListQuery).toBe("function");
    expect(typeof result.current.useDetailQuery).toBe("function");
    expect(typeof result.current.useSchedulesQuery).toBe("function");
    expect(typeof result.current.useStatsQuery).toBe("function");
    expect(typeof result.current.useRetryMutation).toBe("function");
    expect(typeof result.current.useRequeueMutation).toBe("function");
    expect(typeof result.current.useCancelMutation).toBe("function");
    expect(typeof result.current.usePauseScheduleMutation).toBe("function");
    expect(typeof result.current.useResumeScheduleMutation).toBe("function");
  });

  it("invalidates the collection on mutations and tags detail reads by id", () => {
    const {api, endpoints} = createApiDouble();
    renderHook(() => useJobsDashboardApi(api));

    expect(endpoints.jobsDashboardRetry.invalidatesTags).toEqual(["jobsAdmin"]);
    expect(endpoints.jobsDashboardRequeue.invalidatesTags).toEqual(["jobsAdmin"]);
    expect(endpoints.jobsDashboardCancel.invalidatesTags).toEqual(["jobsAdmin"]);
    expect(endpoints.jobsDashboardPauseSchedule.invalidatesTags).toEqual(["jobsAdmin"]);
    expect(endpoints.jobsDashboardResumeSchedule.invalidatesTags).toEqual(["jobsAdmin"]);
    expect(endpoints.jobsDashboardList.providesTags).toEqual(["jobsAdmin"]);
    expect(endpoints.jobsDashboardSchedules.providesTags).toEqual(["jobsAdmin"]);
    expect(endpoints.jobsDashboardStats.providesTags).toEqual(["jobsAdmin"]);

    const providesTags = endpoints.jobsDashboardDetail.providesTags as (
      result: unknown,
      error: unknown,
      id: string
    ) => unknown;
    expect(providesTags(undefined, undefined, "j1")).toEqual([{id: "j1", type: "jobsAdmin"}]);
  });
});

describe("unwrapJobRow", () => {
  it("reads the row out of a {data} envelope or an already-unwrapped row", () => {
    expect(unwrapJobRow({_id: "a", name: "demo", status: "pending"})?._id).toBe("a");
    expect(unwrapJobRow({data: {_id: "b", name: "demo", status: "pending"}})?._id).toBe("b");
  });

  it("returns undefined for payloads without an id", () => {
    expect(unwrapJobRow(undefined)).toBeUndefined();
    expect(unwrapJobRow({status: "dead"})).toBeUndefined();
  });
});

describe("jobRowId", () => {
  it("prefers _id, falls back to id, and degrades to an empty string", () => {
    expect(jobRowId({_id: "a", name: "demo", status: "pending"})).toBe("a");
    expect(jobRowId({id: "b", name: "demo", status: "pending"})).toBe("b");
    expect(jobRowId({name: "demo", status: "pending"})).toBe("");
  });
});
