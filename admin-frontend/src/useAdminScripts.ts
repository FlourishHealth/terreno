import type {Api} from "@reduxjs/toolkit/query/react";
import {useMemo} from "react";
import type {BackgroundTask} from "./types";

export const useAdminScripts = (api: Api<any, any, any, any>, baseUrl: string) => {
  const enhancedApi = useMemo(() => {
    return api.injectEndpoints({
      endpoints: (build: any) => ({
        adminCancelScriptTask: build.mutation({
          invalidatesTags: ["admin_scriptTask"],
          query: (taskId: string) => ({
            method: "DELETE",
            url: `${baseUrl}/scripts/tasks/${taskId}`,
          }),
        }),
        adminGetScriptTask: build.query({
          providesTags: ["admin_scriptTask"],
          query: (taskId: string) => ({
            method: "GET",
            url: `${baseUrl}/scripts/tasks/${taskId}`,
          }),
        }),
        adminRunScript: build.mutation({
          query: ({name, wetRun}: {name: string; wetRun: boolean}) => ({
            method: "POST",
            url: `${baseUrl}/scripts/${name}/run?wetRun=${wetRun}`,
          }),
        }),
      }),
      overrideExisting: true,
    });
  }, [api, baseUrl]);

  return {
    useCancelScriptTaskMutation: (enhancedApi as any).useAdminCancelScriptTaskMutation as () => [
      (taskId: string) => {unwrap: () => Promise<{task: BackgroundTask; message: string}>},
      {isLoading: boolean},
    ],
    useGetScriptTaskQuery: (enhancedApi as any).useAdminGetScriptTaskQuery as (
      taskId: string,
      options?: {skip?: boolean; pollingInterval?: number}
    ) => {data: {task: BackgroundTask} | undefined; isLoading: boolean; error: unknown},
    useRunScriptMutation: (enhancedApi as any).useAdminRunScriptMutation as () => [
      (args: {name: string; wetRun: boolean}) => {unwrap: () => Promise<{taskId: string}>},
      {isLoading: boolean},
    ],
  };
};
