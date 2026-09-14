import {describe, expect, it, mock} from "bun:test";
import {renderHook} from "@testing-library/react-native";
import type {AdminApi, EndpointBuilder} from "../types";
import {commsMessageId, unwrapCommsMessage} from "./commsMessagePayload";
import {useCommsDashboardApi} from "./useCommsDashboardApi";

interface CapturedQuery {
  body?: Record<string, unknown>;
  method: string;
  params?: Record<string, unknown>;
  url: string;
}

interface CapturedEndpoint {
  invalidatesTags?: string[];
  providesTags?: unknown;
  query: (arg: never) => CapturedQuery;
}

/**
 * Stands in for the host RTK Query API. `injectEndpoints` is invoked eagerly so the
 * endpoint definitions can be asserted, then hook names are returned the way RTK Query
 * generates them from endpoint keys.
 */
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
        useCommsDashboardDetailQuery: mock(() => ({isLoading: false})),
        useCommsDashboardListQuery: mock(() => ({isLoading: false})),
        useCommsDashboardRetryManyMutation: mock(() => [mock(() => ({})), {isLoading: false}]),
        useCommsDashboardRetryMutation: mock(() => [mock(() => ({})), {isLoading: false}]),
        useCommsDashboardStatsQuery: mock(() => ({isLoading: false})),
      };
    },
  } as unknown as AdminApi & {injectEndpoints: unknown};
  return {addTagTypes, api: api as AdminApi, endpoints};
};

describe("useCommsDashboardApi", () => {
  it("injects every dashboard endpoint against the comms base path", () => {
    const {addTagTypes, api, endpoints} = createApiDouble();
    const {result} = renderHook(() => useCommsDashboardApi(api));

    expect(addTagTypes[0]).toEqual(["commsMessages"]);
    expect(endpoints.commsDashboardList.query({} as never)).toEqual({
      method: "GET",
      params: {},
      url: "/comms/messages",
    });
    expect(endpoints.commsDashboardDetail.query("m1" as never)).toEqual({
      method: "GET",
      url: "/comms/messages/m1",
    });
    expect(endpoints.commsDashboardRetry.query("m1" as never)).toEqual({
      method: "POST",
      url: "/comms/messages/m1/retry",
    });
    expect(endpoints.commsDashboardRetryMany.query({limit: 5} as never)).toEqual({
      body: {limit: 5},
      method: "POST",
      url: "/comms/messages/retryMany",
    });
    expect(endpoints.commsDashboardStats.query({} as never)).toEqual({
      method: "GET",
      params: {},
      url: "/comms/stats",
    });

    expect(typeof result.current.useListQuery).toBe("function");
    expect(typeof result.current.useDetailQuery).toBe("function");
    expect(typeof result.current.useStatsQuery).toBe("function");
    expect(typeof result.current.useRetryMutation).toBe("function");
    expect(typeof result.current.useRetryManyMutation).toBe("function");
  });

  it("invalidates the collection on both retry mutations and tags detail reads by id", () => {
    const {api, endpoints} = createApiDouble();
    renderHook(() => useCommsDashboardApi(api));

    expect(endpoints.commsDashboardRetry.invalidatesTags).toEqual(["commsMessages"]);
    expect(endpoints.commsDashboardRetryMany.invalidatesTags).toEqual(["commsMessages"]);
    expect(endpoints.commsDashboardList.providesTags).toEqual(["commsMessages"]);
    expect(endpoints.commsDashboardStats.providesTags).toEqual(["commsMessages"]);

    const providesTags = endpoints.commsDashboardDetail.providesTags as (
      result: unknown,
      error: unknown,
      id: string
    ) => unknown;
    expect(providesTags(undefined, undefined, "m1")).toEqual([{id: "m1", type: "commsMessages"}]);
  });
});

describe("unwrapCommsMessage", () => {
  it("reads the row out of a {data} envelope or an already-unwrapped row", () => {
    expect(unwrapCommsMessage({_id: "a"})?._id).toBe("a");
    expect(unwrapCommsMessage({data: {_id: "b"}})?._id).toBe("b");
    expect(unwrapCommsMessage({data: {data: {id: "c"}}})?._id).toBe("c");
  });

  it("normalizes a non-string id", () => {
    expect(unwrapCommsMessage({id: 42})?._id).toBe("42");
  });

  it("returns undefined for payloads without an id", () => {
    expect(unwrapCommsMessage(undefined)).toBeUndefined();
    expect(unwrapCommsMessage("row")).toBeUndefined();
    expect(unwrapCommsMessage({status: "failed"})).toBeUndefined();
    expect(unwrapCommsMessage({_id: ""})).toBeUndefined();
    expect(unwrapCommsMessage({data: []})).toBeUndefined();
  });
});

describe("commsMessageId", () => {
  it("prefers _id, falls back to id, and degrades to an empty string", () => {
    expect(
      commsMessageId({_id: "a", channel: "mail", provider: "p", status: "failed", to: "t"})
    ).toBe("a");
    expect(
      commsMessageId({channel: "mail", id: "b", provider: "p", status: "failed", to: "t"})
    ).toBe("b");
    expect(commsMessageId({channel: "mail", provider: "p", status: "failed", to: "t"})).toBe("");
  });
});
