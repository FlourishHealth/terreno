import {useMemo} from "react";
import {withQueryString} from "../adminRpc";
import {asDynamicHookApi} from "../dynamicHookApi";
import type {AdminApi, EndpointBuilder} from "../types";
import {useAdminRpc, useAdminRpcMutation, useAdminRpcQuery} from "../useAdminRpc";
import type {CommsDashboardFilters} from "./commsDashboardParams";
import type {CommsMessageRow} from "./commsMessagePayload";

export type {CommsMessageAttempt, CommsMessageRow} from "./commsMessagePayload";

export interface CommsListResponse {
  data: CommsMessageRow[];
  limit: number;
  more: boolean;
  page: number;
  total: number;
}

export interface CommsStatsResponse {
  buckets: Array<{channel: string; count: number; day: string; provider: string; status: string}>;
  byProvider: Array<{
    bounced: number;
    delivered: number;
    failed: number;
    failureRate: number;
    provider: string;
    sent: number;
    total: number;
  }>;
  totals: {
    bounced: number;
    cancelled: number;
    delivered: number;
    failed: number;
    failureRate: number;
    sent: number;
    total: number;
  };
}

export interface CommsRetryManyResponse {
  retried: CommsMessageRow[];
  skipped: Array<{id: string; reason: string}>;
}

const LIST_KEY = "commsDashboardList";
const DETAIL_KEY = "commsDashboardDetail";
const STATS_KEY = "commsDashboardStats";
const RETRY_KEY = "commsDashboardRetry";
const RETRY_MANY_KEY = "commsDashboardRetryMany";

export const useCommsDashboardApi = (api: AdminApi) => {
  const rpc = useAdminRpc();
  const enhancedApi = useMemo(
    () =>
      api.enhanceEndpoints({addTagTypes: ["commsMessages"]}).injectEndpoints({
        endpoints: (build: EndpointBuilder) => ({
          [DETAIL_KEY]: build.query({
            providesTags: (_result: unknown, _error: unknown, id: string) => [
              {id, type: "commsMessages"},
            ],
            query: (id: string) => ({method: "GET", url: `/comms/messages/${id}`}),
          }),
          [LIST_KEY]: build.query({
            providesTags: ["commsMessages"],
            query: (params: Record<string, unknown>) => ({
              method: "GET",
              params,
              url: "/comms/messages",
            }),
          }),
          [RETRY_KEY]: build.mutation({
            invalidatesTags: ["commsMessages"],
            query: (id: string) => ({
              method: "POST",
              url: `/comms/messages/${id}/retry`,
            }),
          }),
          [RETRY_MANY_KEY]: build.mutation({
            invalidatesTags: ["commsMessages"],
            query: (body: Record<string, unknown>) => ({
              body,
              method: "POST",
              url: "/comms/messages/retryMany",
            }),
          }),
          [STATS_KEY]: build.query({
            providesTags: ["commsMessages"],
            query: (params: Record<string, unknown>) => ({
              method: "GET",
              params,
              url: "/comms/stats",
            }),
          }),
        }),
        overrideExisting: true,
      }),
    [api]
  );

  const hooks = asDynamicHookApi(enhancedApi);
  if (rpc) {
    return {
      useDetailQuery: (id: string) =>
        useAdminRpcQuery<CommsMessageRow | {data: CommsMessageRow}>({
          rpc,
          url: `/comms/messages/${id}`,
        }),
      useListQuery: (
        params: CommsDashboardFilters & {
          limit?: number;
        }
      ) =>
        useAdminRpcQuery<CommsListResponse>({
          rpc,
          url: withQueryString({params: params as Record<string, unknown>, url: "/comms/messages"}),
        }),
      useRetryManyMutation: () => {
        const [trigger, meta] = useAdminRpcMutation(rpc);
        return [
          (body: Record<string, unknown>) =>
            trigger({body, method: "POST", url: "/comms/messages/retryMany"}),
          meta,
        ] as [
          (body: Record<string, unknown>) => {unwrap: () => Promise<CommsRetryManyResponse>},
          {isLoading: boolean},
        ];
      },
      useRetryMutation: () => {
        const [trigger, meta] = useAdminRpcMutation(rpc);
        return [
          (id: string) => trigger({method: "POST", url: `/comms/messages/${id}/retry`}),
          meta,
        ] as [
          (id: string) => {unwrap: () => Promise<CommsMessageRow | {data: CommsMessageRow}>},
          {isLoading: boolean},
        ];
      },
      useStatsQuery: (params: CommsDashboardFilters) =>
        useAdminRpcQuery<CommsStatsResponse>({
          rpc,
          url: withQueryString({params: params as Record<string, unknown>, url: "/comms/stats"}),
        }),
    };
  }
  return {
    useDetailQuery: hooks.useCommsDashboardDetailQuery as (id: string) => {
      data?: CommsMessageRow | {data: CommsMessageRow};
      error?: unknown;
      isLoading: boolean;
    },
    useListQuery: hooks.useCommsDashboardListQuery as (
      params: CommsDashboardFilters & {
        limit?: number;
      }
    ) => {
      data?: CommsListResponse;
      error?: unknown;
      isLoading: boolean;
    },
    useRetryManyMutation: hooks.useCommsDashboardRetryManyMutation as () => [
      (body: Record<string, unknown>) => {unwrap: () => Promise<CommsRetryManyResponse>},
      {isLoading: boolean},
    ],
    useRetryMutation: hooks.useCommsDashboardRetryMutation as () => [
      (id: string) => {unwrap: () => Promise<CommsMessageRow | {data: CommsMessageRow}>},
      {isLoading: boolean},
    ],
    useStatsQuery: hooks.useCommsDashboardStatsQuery as (params: CommsDashboardFilters) => {
      data?: CommsStatsResponse;
      error?: unknown;
      isLoading: boolean;
    },
  };
};
