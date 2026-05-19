import {useMemo} from "react";
import type {AdminApi, BackgroundTask, EndpointBuilder} from "./types";

export const useAdminScripts = (api: AdminApi, baseUrl: string) => {
  const enhancedApi = useMemo(() => {
    return api.injectEndpoints({
      endpoints: (build: EndpointBuilder) => ({
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

  // biome-ignore lint/suspicious/noExplicitAny: dynamic hook lookup on RTK Query enhanced API
  const enhanced = enhancedApi as any;
  return {
    useCancelScriptTaskMutation: enhanced.useAdminCancelScriptTaskMutation as () => [
      (taskId: string) => {unwrap: () => Promise<{task: BackgroundTask; message: string}>},
      {isLoading: boolean},
    ],
    useGetScriptTaskQuery: enhanced.useAdminGetScriptTaskQuery as (
      taskId: string,
      options?: {skip?: boolean; pollingInterval?: number}
    ) => {data: {task: BackgroundTask} | undefined; isLoading: boolean; error: unknown},
    useRunScriptMutation: enhanced.useAdminRunScriptMutation as () => [
      (args: {name: string; wetRun: boolean}) => {unwrap: () => Promise<{taskId: string}>},
      {isLoading: boolean},
    ],
  };
};
