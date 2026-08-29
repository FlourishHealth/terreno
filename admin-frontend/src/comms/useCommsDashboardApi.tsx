import {useMemo} from "react";
import {asDynamicHookApi} from "../dynamicHookApi";
import type {AdminApi, EndpointBuilder} from "../types";
import type {CommsDashboardFilters} from "./commsDashboardParams";

export interface CommsMessageRow {
  _id: string;
  attempts?: Array<{
    at?: string;
    error?: string;
    errorClass?: string;
    errorCode?: string;
    provider?: string;
    providerMessageId?: string;
  }>;
  attemptCount?: number;
  channel: string;
  created?: string;
  error?: string;
  errorClass?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
  payload?: unknown;
  provider: string;
  retriedById?: string;
  retriedFromId?: string;
  retryDisabledReason?: string;
  retryable?: boolean;
  retries?: CommsMessageRow[];
  status: string;
  subject?: string;
  templateId?: string;
  to: string;
  userId?: string;
}

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
  return {
    useDetailQuery: hooks.useCommsDashboardDetailQuery as (id: string) => {
      data?: {data: CommsMessageRow};
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
      (id: string) => {unwrap: () => Promise<{data: CommsMessageRow}>},
      {isLoading: boolean},
    ],
    useStatsQuery: hooks.useCommsDashboardStatsQuery as (params: CommsDashboardFilters) => {
      data?: CommsStatsResponse;
      error?: unknown;
      isLoading: boolean;
    },
  };
};
