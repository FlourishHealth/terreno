import {useMemo} from "react";

import {asDynamicHookApi} from "./dynamicHookApi";
import type {AdminApi, EndpointBuilder} from "./types";

export interface AdminBackgroundTaskBody {
  ids?: string[];
  kind: string;
  metadata?: Record<string, unknown>;
  resourceRoute?: string;
}

/**
 * RTK Query mutation hook for `POST {adminApiRoot}/background-tasks` (admin enqueue).
 */
type UseAdminBackgroundTaskMutation = () => unknown;

export const useAdminBackgroundTaskMutation = (
  api: AdminApi,
  adminApiRoot: string
): UseAdminBackgroundTaskMutation => {
  const enhancedApi = useMemo(() => {
    const root = adminApiRoot.replace(/\/$/, "");
    return api.enhanceEndpoints({addTagTypes: ["AdminBackgroundTask"]}).injectEndpoints({
      endpoints: (build: EndpointBuilder) => ({
        adminPostBackgroundTask: build.mutation({
          invalidatesTags: [],
          query: (body: AdminBackgroundTaskBody) => ({
            body,
            method: "POST",
            url: `${root}/background-tasks`,
          }),
        }),
      }),
      overrideExisting: true,
    });
  }, [api, adminApiRoot]);

  const enhanced = asDynamicHookApi(enhancedApi);
  return enhanced.useAdminPostBackgroundTaskMutation();
};
