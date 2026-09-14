import type {EndpointBuilder} from "../types";

type AdminPayload = Record<string, unknown>;
type TagArg = unknown;

export interface AdminModelEndpointContext {
  headers: Record<string, string> | undefined;
  modelName: string;
  organizationId: string | undefined;
  routePath: string;
}

export const adminOrganizationHeaders = (
  organizationId: string | undefined
): Record<string, string> | undefined => {
  if (!organizationId) {
    return undefined;
  }
  return {"X-Organization-Id": organizationId};
};

export const buildAdminModelEndpoints = (
  build: EndpointBuilder,
  context: AdminModelEndpointContext
) => {
  const listKey = `adminList_${context.modelName}`;
  const readKey = `adminRead_${context.modelName}`;
  const createKey = `adminCreate_${context.modelName}`;
  const updateKey = `adminUpdate_${context.modelName}`;
  const deleteKey = `adminDelete_${context.modelName}`;
  const bulkPatchKey = `adminBulkPatch_${context.modelName}`;
  const {headers, organizationId, routePath} = context;

  return {
    [listKey]: build.query({
      providesTags: [`admin_${context.modelName}`],
      query: (params: Record<string, unknown> | undefined) => ({
        headers,
        method: "GET",
        params: params ?? {},
        url: routePath,
      }),
      serializeQueryArgs: ({endpointName, queryArgs}) =>
        `${endpointName}:${organizationId ?? ""}:${JSON.stringify(queryArgs ?? {})}`,
    }),
    [readKey]: build.query({
      providesTags: (_result: TagArg, _error: TagArg, id: string) => [
        {id, type: `admin_${context.modelName}`},
      ],
      query: (id: string) => ({
        headers,
        method: "GET",
        url: `${routePath}/${id}`,
      }),
      serializeQueryArgs: ({endpointName, queryArgs}) =>
        `${endpointName}:${organizationId ?? ""}:${String(queryArgs)}`,
    }),
    [createKey]: build.mutation({
      invalidatesTags: [`admin_${context.modelName}`],
      query: (body: AdminPayload) => ({
        body,
        headers,
        method: "POST",
        url: routePath,
      }),
    }),
    [updateKey]: build.mutation({
      invalidatesTags: (_result: TagArg, _error: TagArg, {id}: {id: string}) => [
        {id, type: `admin_${context.modelName}`},
        `admin_${context.modelName}`,
      ],
      query: ({id, body}: {id: string; body: AdminPayload}) => ({
        body,
        headers,
        method: "PATCH",
        url: `${routePath}/${id}`,
      }),
    }),
    [deleteKey]: build.mutation({
      invalidatesTags: [`admin_${context.modelName}`],
      query: (id: string) => ({
        headers,
        method: "DELETE",
        url: `${routePath}/${id}`,
      }),
    }),
    [bulkPatchKey]: build.mutation({
      invalidatesTags: [`admin_${context.modelName}`],
      query: ({ids, patch}: {ids: string[]; patch: Record<string, unknown>}) => ({
        body: {ids, patch},
        headers,
        method: "POST",
        url: `${routePath}/bulk-patch`,
      }),
    }),
  };
};
