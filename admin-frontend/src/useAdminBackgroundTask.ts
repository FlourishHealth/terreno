import {useMemo} from "react";
import {asJsonBody} from "./adminRpc";

import {asDynamicHookApi} from "./dynamicHookApi";
import type {AdminApi, EndpointBuilder} from "./types";
import {useAdminRpc, useAdminRpcMutation} from "./useAdminRpc";

export interface AdminBackgroundTaskBody {
  ids?: string[];
  kind: string;
  metadata?: Record<string, unknown>;
  resourceRoute?: string;
}

type AdminBackgroundTaskMutation = readonly [
  (body: AdminBackgroundTaskBody) => {unwrap: () => Promise<unknown>},
  {isLoading: boolean},
];

/**
 * RTK Query mutation hook for `POST {adminApiRoot}/background-tasks` (admin enqueue).
 */
export const useAdminBackgroundTaskMutation = (
  api: AdminApi,
  adminApiRoot: string
): AdminBackgroundTaskMutation => {
  const rpc = useAdminRpc();
  const root = adminApiRoot.replace(/\/$/, "");
  const [rpcTrigger, rpcMeta] = useAdminRpcMutation(rpc);
  const enhancedApi = useMemo(() => {
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
  }, [api, root]);

  const enhanced = asDynamicHookApi(enhancedApi);
  const rtkMutation = enhanced.useAdminPostBackgroundTaskMutation() as AdminBackgroundTaskMutation;
  if (rpc) {
    return [
      (body: AdminBackgroundTaskBody) =>
        rpcTrigger({
          body: asJsonBody(body),
          method: "POST",
          url: `${root}/background-tasks`,
        }),
      rpcMeta,
    ];
  }
  return rtkMutation;
};
