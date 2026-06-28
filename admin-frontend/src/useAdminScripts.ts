import {useMemo} from "react";
import type {AdminApi, BackgroundTask, EndpointBuilder, ScriptRunListResponse} from "./types";

export interface ScriptRunsQueryArg {
  /** Limit history to a single script by `taskType`. Omit for all scripts. */
  name?: string;
  page?: number;
  limit?: number;
}

interface ScriptRunsQueryResult {
  data: ScriptRunListResponse | undefined;
  isLoading: boolean;
  isFetching?: boolean;
  error: unknown;
  refetch?: () => void;
}

const EMPTY_RUNS_HOOK = (): ScriptRunsQueryResult => ({
  data: undefined,
  error: null,
  isFetching: false,
  isLoading: false,
});

export const useAdminScripts = (api: AdminApi, apiBase: string) => {
  const enhancedApi = useMemo(() => {
    // Guard: some call sites (and tests) pass a type-erased API double without
    // `injectEndpoints`. Return null so we can fall back to no-op hooks.
    if (typeof api?.injectEndpoints !== "function") {
      return null;
    }
    return api.injectEndpoints({
      endpoints: (build: EndpointBuilder) => ({
        adminCancelScriptTask: build.mutation({
          invalidatesTags: ["admin_scriptTask", "admin_scriptRuns"],
          query: (taskId: string) => ({
            method: "DELETE",
            url: `${apiBase}/scripts/tasks/${taskId}`,
          }),
        }),
        adminGetScriptTask: build.query({
          providesTags: ["admin_scriptTask"],
          query: (taskId: string) => ({
            method: "GET",
            url: `${apiBase}/scripts/tasks/${taskId}`,
          }),
        }),
        adminListScriptRuns: build.query({
          providesTags: ["admin_scriptRuns"],
          query: ({name, page = 1, limit = 25}: ScriptRunsQueryArg = {}) => {
            const params = new URLSearchParams();
            params.set("page", String(page));
            params.set("limit", String(limit));
            if (name) {
              params.set("name", name);
            }
            return {method: "GET", url: `${apiBase}/scripts/runs?${params.toString()}`};
          },
        }),
        adminRunScript: build.mutation({
          invalidatesTags: ["admin_scriptRuns"],
          query: ({name, wetRun}: {name: string; wetRun: boolean}) => ({
            method: "POST",
            url: `${apiBase}/scripts/${name}/run?wetRun=${wetRun}`,
          }),
        }),
      }),
      overrideExisting: true,
    });
  }, [api, apiBase]);

  // noExplicitAny: RTK Query generates hook names dynamically; not statically expressible
  // biome-ignore lint/suspicious/noExplicitAny: dynamic hook lookup on RTK Query enhanced API
  const enhanced = enhancedApi as any;

  return {
    useCancelScriptTaskMutation: (enhanced?.useAdminCancelScriptTaskMutation ??
      (() => [() => ({unwrap: () => Promise.resolve({})}), {isLoading: false}])) as () => [
      (taskId: string) => {unwrap: () => Promise<{task: BackgroundTask; message: string}>},
      {isLoading: boolean},
    ],
    useGetScriptTaskQuery: (enhanced?.useAdminGetScriptTaskQuery ??
      (() => ({data: undefined, error: null, isLoading: false}))) as (
      taskId: string,
      options?: {skip?: boolean; pollingInterval?: number}
    ) => {data: {task: BackgroundTask} | undefined; isLoading: boolean; error: unknown},
    useListScriptRunsQuery: (enhanced?.useAdminListScriptRunsQuery ?? EMPTY_RUNS_HOOK) as (
      arg?: ScriptRunsQueryArg,
      options?: {skip?: boolean; pollingInterval?: number}
    ) => ScriptRunsQueryResult,
    useRunScriptMutation: (enhanced?.useAdminRunScriptMutation ??
      (() => [
        () => ({unwrap: () => Promise.resolve({taskId: ""})}),
        {isLoading: false},
      ])) as () => [
      (args: {name: string; wetRun: boolean}) => {unwrap: () => Promise<{taskId: string}>},
      {isLoading: boolean},
    ],
  };
};
