import {useMemo} from "react";

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
export const useAdminBackgroundTaskMutation = (
  api: AdminApi,
  adminApiRoot: string
): ReturnType<// biome-ignore lint/suspicious/noExplicitAny: RTK mutation type from dynamic injectEndpoints
any> => {
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

  // biome-ignore lint/suspicious/noExplicitAny: dynamic hook lookup on RTK Query enhanced API
  const enhanced = enhancedApi as any;
  return enhanced.useAdminPostBackgroundTaskMutation();
};
