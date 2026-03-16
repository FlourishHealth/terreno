import type {Api} from "@reduxjs/toolkit/query/react";
import {useMemo} from "react";

export const useFlagsApi = (api: Api<any, any, any, any>, basePath: string) => {
  const enhancedApi = useMemo(() => {
    return api.injectEndpoints({
      endpoints: (build: any) => ({
        flagsGetFlag: build.query({
          providesTags: (_result: any, _error: any, key: string) => [
            {id: key, type: "admin_flags"},
          ],
          query: (key: string) => ({
            method: "GET",
            url: `${basePath}/flags/${key}`,
          }),
        }),
        flagsListFlags: build.query({
          providesTags: ["admin_flags"],
          query: (params?: {status?: string}) => ({
            method: "GET",
            params: params ?? {},
            url: `${basePath}/flags`,
          }),
        }),
        flagsListFlagUsers: build.query({
          providesTags: (_result: any, _error: any, key: string) => [
            {id: `${key}_users`, type: "admin_flags"},
          ],
          query: (key: string) => ({
            method: "GET",
            url: `${basePath}/flags/${key}/users`,
          }),
        }),
        flagsMyFlags: build.query({
          providesTags: ["admin_flags_me"],
          query: () => ({
            method: "GET",
            url: `${basePath}/flags/me`,
          }),
        }),
        flagsRemoveUserOverride: build.mutation({
          invalidatesTags: ["admin_flags"],
          query: ({key, userId}: {key: string; userId: string}) => ({
            method: "DELETE",
            url: `${basePath}/flags/${key}/users/${userId}`,
          }),
        }),
        flagsSetUserOverride: build.mutation({
          invalidatesTags: ["admin_flags"],
          query: ({key, userId, value}: {key: string; userId: string; value: any}) => ({
            body: {value},
            method: "PUT",
            url: `${basePath}/flags/${key}/users/${userId}`,
          }),
        }),
        flagsUpdateFlag: build.mutation({
          invalidatesTags: (_result: any, _error: any, {key}: {key: string}) => [
            {id: key, type: "admin_flags"},
            "admin_flags",
          ],
          query: ({key, ...body}: {key: string; enabled?: boolean; globalValue?: any}) => ({
            body,
            method: "PATCH",
            url: `${basePath}/flags/${key}`,
          }),
        }),
      }),
      overrideExisting: false,
    });
  }, [api, basePath]);

  return {
    useGetFlagQuery: (enhancedApi as any).useFlagsGetFlagQuery,
    useListFlagsQuery: (enhancedApi as any).useFlagsListFlagsQuery,
    useListFlagUsersQuery: (enhancedApi as any).useFlagsListFlagUsersQuery,
    useMyFlagsQuery: (enhancedApi as any).useFlagsMyFlagsQuery,
    useRemoveUserOverrideMutation: (enhancedApi as any).useFlagsRemoveUserOverrideMutation,
    useSetUserOverrideMutation: (enhancedApi as any).useFlagsSetUserOverrideMutation,
    useUpdateFlagMutation: (enhancedApi as any).useFlagsUpdateFlagMutation,
  };
};
