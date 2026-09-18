import {useMemo} from "react";
import {asDynamicHookApi} from "../dynamicHookApi";
import type {AdminApi, EndpointBuilder} from "../types";
import type {JobRow, JobScheduleRow, JobsListResponse, JobsStats} from "./jobPayload";
import type {JobsDashboardFilters} from "./jobsDashboardParams";

const LIST_KEY = "jobsDashboardList";
const DETAIL_KEY = "jobsDashboardDetail";
const SCHEDULES_KEY = "jobsDashboardSchedules";
const STATS_KEY = "jobsDashboardStats";
const RETRY_KEY = "jobsDashboardRetry";
const REQUEUE_KEY = "jobsDashboardRequeue";
const CANCEL_KEY = "jobsDashboardCancel";
const PAUSE_SCHEDULE_KEY = "jobsDashboardPauseSchedule";
const RESUME_SCHEDULE_KEY = "jobsDashboardResumeSchedule";

export const useJobsDashboardApi = (api: AdminApi) => {
  const enhancedApi = useMemo(
    () =>
      api.enhanceEndpoints({addTagTypes: ["jobsAdmin"]}).injectEndpoints({
        endpoints: (build: EndpointBuilder) => ({
          [CANCEL_KEY]: build.mutation({
            invalidatesTags: ["jobsAdmin"],
            query: (id: string) => ({
              method: "POST",
              url: `/jobs/${id}/cancel`,
            }),
          }),
          [DETAIL_KEY]: build.query({
            providesTags: (_result: unknown, _error: unknown, id: string) => [
              {id, type: "jobsAdmin"},
            ],
            query: (id: string) => ({method: "GET", url: `/jobs/${id}`}),
          }),
          [LIST_KEY]: build.query({
            providesTags: ["jobsAdmin"],
            query: (params: Record<string, unknown>) => ({
              method: "GET",
              params,
              url: "/jobs",
            }),
          }),
          [PAUSE_SCHEDULE_KEY]: build.mutation({
            invalidatesTags: ["jobsAdmin"],
            query: (name: string) => ({
              method: "POST",
              url: `/jobs/schedules/${encodeURIComponent(name)}/pause`,
            }),
          }),
          [REQUEUE_KEY]: build.mutation({
            invalidatesTags: ["jobsAdmin"],
            query: (id: string) => ({
              method: "POST",
              url: `/jobs/${id}/requeue`,
            }),
          }),
          [RESUME_SCHEDULE_KEY]: build.mutation({
            invalidatesTags: ["jobsAdmin"],
            query: (name: string) => ({
              method: "POST",
              url: `/jobs/schedules/${encodeURIComponent(name)}/resume`,
            }),
          }),
          [RETRY_KEY]: build.mutation({
            invalidatesTags: ["jobsAdmin"],
            query: (id: string) => ({
              method: "POST",
              url: `/jobs/${id}/retry`,
            }),
          }),
          [SCHEDULES_KEY]: build.query({
            providesTags: ["jobsAdmin"],
            query: () => ({method: "GET", url: "/jobs/schedules"}),
          }),
          [STATS_KEY]: build.query({
            providesTags: ["jobsAdmin"],
            query: () => ({method: "GET", url: "/jobs/stats"}),
          }),
        }),
        overrideExisting: true,
      }),
    [api]
  );

  const hooks = asDynamicHookApi(enhancedApi);
  return {
    useCancelMutation: hooks.useJobsDashboardCancelMutation as () => [
      (id: string) => {unwrap: () => Promise<JobRow | {data: JobRow}>},
      {isLoading: boolean},
    ],
    useDetailQuery: hooks.useJobsDashboardDetailQuery as (id: string) => {
      data?: JobRow | {data: JobRow};
      error?: unknown;
      isLoading: boolean;
    },
    useListQuery: hooks.useJobsDashboardListQuery as (
      params: JobsDashboardFilters & {
        limit?: number;
      }
    ) => {
      data?: JobsListResponse;
      error?: unknown;
      isLoading: boolean;
    },
    usePauseScheduleMutation: hooks.useJobsDashboardPauseScheduleMutation as () => [
      (name: string) => {unwrap: () => Promise<unknown>},
      {isLoading: boolean},
    ],
    useRequeueMutation: hooks.useJobsDashboardRequeueMutation as () => [
      (id: string) => {unwrap: () => Promise<JobRow | {data: JobRow}>},
      {isLoading: boolean},
    ],
    useResumeScheduleMutation: hooks.useJobsDashboardResumeScheduleMutation as () => [
      (name: string) => {unwrap: () => Promise<unknown>},
      {isLoading: boolean},
    ],
    useRetryMutation: hooks.useJobsDashboardRetryMutation as () => [
      (id: string) => {unwrap: () => Promise<JobRow | {data: JobRow}>},
      {isLoading: boolean},
    ],
    useSchedulesQuery: hooks.useJobsDashboardSchedulesQuery as () => {
      data?: JobScheduleRow[];
      error?: unknown;
      isLoading: boolean;
    },
    useStatsQuery: hooks.useJobsDashboardStatsQuery as () => {
      data?: JobsStats;
      error?: unknown;
      isLoading: boolean;
    },
  };
};
