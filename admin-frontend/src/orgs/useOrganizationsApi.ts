import {useMemo} from "react";
import {asDynamicHookApi} from "../dynamicHookApi";
import type {AdminApi, EndpointBuilder} from "../types";

interface OrganizationMutation {
  id: string;
  body: Record<string, unknown>;
}

interface MembershipMutation extends OrganizationMutation {
  memberId: string;
}

const organizationHeaders = (organizationId?: string): Record<string, string> | undefined => {
  if (!organizationId) {
    return undefined;
  }
  return {"X-Organization-Id": organizationId};
};

/** RTK Query hooks for the framework OrgsApp routes. */
export const useOrganizationsApi = (api: AdminApi, basePath = "/orgs", organizationId?: string) => {
  const enhancedApi = useMemo(
    () =>
      api
        .enhanceEndpoints({addTagTypes: ["organizations", "organization-members"]})
        .injectEndpoints({
          endpoints: (build: EndpointBuilder) => ({
            orgCreate: build.mutation({
              invalidatesTags: ["organizations"],
              query: (body: Record<string, unknown>) => ({
                body,
                method: "POST",
                url: basePath,
              }),
            }),
            orgDelete: build.mutation({
              invalidatesTags: ["organizations"],
              query: (id: string) => ({method: "DELETE", url: `${basePath}/${id}`}),
            }),
            orgList: build.query({
              providesTags: ["organizations"],
              query: () => ({method: "GET", url: basePath}),
            }),
            orgMemberAttach: build.mutation({
              invalidatesTags: ["organization-members"],
              query: ({body, id}: OrganizationMutation) => ({
                body,
                headers: organizationHeaders(id),
                method: "POST",
                url: `${basePath}/${id}/members`,
              }),
            }),
            orgMemberRemove: build.mutation({
              invalidatesTags: ["organization-members"],
              query: ({id, memberId}: MembershipMutation) => ({
                headers: organizationHeaders(id),
                method: "DELETE",
                url: `${basePath}/${id}/members/${memberId}`,
              }),
            }),
            orgMembers: build.query({
              providesTags: ["organization-members"],
              query: (id: string) => ({
                headers: organizationHeaders(id),
                method: "GET",
                url: `${basePath}/${id}/members`,
              }),
            }),
            orgMemberUpdate: build.mutation({
              invalidatesTags: ["organization-members"],
              query: ({body, id, memberId}: MembershipMutation) => ({
                body,
                headers: organizationHeaders(id),
                method: "PATCH",
                url: `${basePath}/${id}/members/${memberId}`,
              }),
            }),
            orgMine: build.query({
              providesTags: ["organizations"],
              query: () => ({method: "GET", url: `${basePath}/mine`}),
            }),
            orgRead: build.query({
              providesTags: ["organizations"],
              query: (id: string) => ({
                headers: organizationHeaders(id),
                method: "GET",
                url: `${basePath}/${id}`,
              }),
            }),
            orgUpdate: build.mutation({
              invalidatesTags: ["organizations"],
              query: ({body, id}: OrganizationMutation) => ({
                body,
                headers: organizationHeaders(id),
                method: "PATCH",
                url: `${basePath}/${id}`,
              }),
            }),
          }),
          overrideExisting: true,
        }),
    [api, basePath, organizationId]
  );
  const hooks = asDynamicHookApi(enhancedApi);
  return {
    useCreateMutation: hooks.useOrgCreateMutation,
    useDeleteMutation: hooks.useOrgDeleteMutation,
    useListQuery: hooks.useOrgListQuery,
    useMemberAttachMutation: hooks.useOrgMemberAttachMutation,
    useMemberRemoveMutation: hooks.useOrgMemberRemoveMutation,
    useMembersQuery: hooks.useOrgMembersQuery,
    useMemberUpdateMutation: hooks.useOrgMemberUpdateMutation,
    useMineQuery: hooks.useOrgMineQuery,
    useReadQuery: hooks.useOrgReadQuery,
    useUpdateMutation: hooks.useOrgUpdateMutation,
  };
};
