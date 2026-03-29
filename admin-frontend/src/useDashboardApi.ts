import type {Api} from "@reduxjs/toolkit/query/react";
import {useMemo} from "react";

import type {ChartConfig, DataSourceMeta} from "./types";

export interface DashboardWidget {
  widgetId: string;
  chart: ChartConfig;
}

export interface Dashboard {
  _id: string;
  title: string;
  description?: string;
  userId: string;
  widgets: DashboardWidget[];
  created: string;
  updated: string;
  deleted: boolean;
}

export interface DashboardListResponse {
  data: Dashboard[];
  total: number;
  page: number;
  limit: number;
  more: boolean;
}

export interface QueryResult {
  data: Record<string, unknown>[];
  meta: {
    total: number;
    truncated: boolean;
    mongodbVersion: string;
  };
}

export interface SourcesResponse {
  data: DataSourceMeta[];
  supportsWindowFields: boolean;
}

export interface CreateDashboardInput {
  title: string;
  description?: string;
  widgets?: {chart: ChartConfig}[];
}

export interface UpdateDashboardInput {
  id: string;
  title?: string;
  description?: string;
  widgets?: {widgetId?: string; chart: ChartConfig}[];
}

/**
 * RTK Query hooks for dashboard CRUD and query operations.
 * Widget data queries use `useQueryEndpoint` pattern (not mutations) to enable
 * 60-second caching and request deduplication across widgets.
 */
export const useDashboardApi = (api: Api<any, any, any, any>) => {
  const enhanced = useMemo(() => {
    return api.injectEndpoints({
      endpoints: (build: any) => ({
        // Dashboard CRUD
        dashboardCreate: build.mutation({
          invalidatesTags: ["dashboard"],
          query: (body: CreateDashboardInput) => ({
            body,
            method: "POST",
            url: "/admin/dashboards",
          }),
        }),
        dashboardDelete: build.mutation({
          invalidatesTags: ["dashboard"],
          query: (id: string) => ({
            method: "DELETE",
            url: `/admin/dashboards/${id}`,
          }),
        }),
        dashboardGet: build.query({
          providesTags: (_result: any, _error: any, id: string) => [{id, type: "dashboard"}],
          query: (id: string) => ({
            method: "GET",
            url: `/admin/dashboards/${id}`,
          }),
        }),
        dashboardList: build.query({
          providesTags: ["dashboard"],
          query: (params: {page?: number; limit?: number} = {}) => ({
            method: "GET",
            params,
            url: "/admin/dashboards",
          }),
        }),
        // Query execution — use query (not mutation) to enable caching per ChartConfig
        dashboardQuery: build.query({
          // 60-second cache TTL
          keepUnusedDataFor: 60,
          query: (chartConfig: ChartConfig) => ({
            body: chartConfig,
            method: "POST",
            url: "/admin/dashboards/query",
          }),
        }),
        // Data sources
        dashboardSources: build.query({
          keepUnusedDataFor: 300,
          query: () => ({
            method: "GET",
            url: "/admin/dashboards/sources",
          }),
        }),
        dashboardUpdate: build.mutation({
          invalidatesTags: (_result: any, _error: any, {id}: {id: string}) => [
            {id, type: "dashboard"},
            "dashboard",
          ],
          query: ({id, ...body}: UpdateDashboardInput) => ({
            body,
            method: "PATCH",
            url: `/admin/dashboards/${id}`,
          }),
        }),
      }),
      overrideExisting: true,
    });
  }, [api]);

  return {
    useCreateDashboardMutation: (enhanced as any).useDashboardCreateMutation as () => [
      (input: CreateDashboardInput) => Promise<{data: Dashboard}>,
      {isLoading: boolean; error?: unknown},
    ],
    // Key for cache: serialize ChartConfig so same config reuses cache
    useDashboardQueryQuery: (enhanced as any).useDashboardQueryQuery as (
      chartConfig: ChartConfig,
      options?: {skip?: boolean}
    ) => {data?: QueryResult; isLoading: boolean; isFetching: boolean; error?: unknown},
    useDeleteDashboardMutation: (enhanced as any).useDashboardDeleteMutation as () => [
      (id: string) => Promise<void>,
      {isLoading: boolean; error?: unknown},
    ],
    useGetDashboardQuery: (enhanced as any).useDashboardGetQuery as (
      id: string,
      options?: {skip?: boolean}
    ) => {data?: Dashboard; isLoading: boolean; error?: unknown},
    useListDashboardsQuery: (enhanced as any).useDashboardListQuery as (params?: {
      page?: number;
      limit?: number;
    }) => {data?: DashboardListResponse; isLoading: boolean; error?: unknown},
    useSourcesQuery: (enhanced as any).useDashboardSourcesQuery as () => {
      data?: SourcesResponse;
      isLoading: boolean;
      error?: unknown;
    },
    useUpdateDashboardMutation: (enhanced as any).useDashboardUpdateMutation as () => [
      (input: UpdateDashboardInput) => Promise<{data: Dashboard}>,
      {isLoading: boolean; error?: unknown},
    ],
  };
};
