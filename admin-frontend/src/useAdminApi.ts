import type {Api} from "@reduxjs/toolkit/query/react";
import {useMemo} from "react";

export const useAdminApi = (api: Api<any, any, any, any>, routePath: string, modelName: string) => {
  const enhancedApi = useMemo(() => {
    const listKey = `adminList_${modelName}`;
    const readKey = `adminRead_${modelName}`;
    const createKey = `adminCreate_${modelName}`;
    const updateKey = `adminUpdate_${modelName}`;
    const deleteKey = `adminDelete_${modelName}`;

    return api.injectEndpoints({
      endpoints: (build: any) => ({
        [listKey]: build.query({
          providesTags: [`admin_${modelName}`],
          query: (params: any) => ({
            method: "GET",
            params: params ?? {},
            url: routePath,
          }),
        }),
        [readKey]: build.query({
          providesTags: (_result: any, _error: any, id: string) => [
            {id, type: `admin_${modelName}`},
          ],
          query: (id: string) => ({
            method: "GET",
            url: `${routePath}/${id}`,
          }),
        }),
        [createKey]: build.mutation({
          invalidatesTags: [`admin_${modelName}`],
          query: (body: any) => ({
            body,
            method: "POST",
            url: routePath,
          }),
        }),
        [updateKey]: build.mutation({
          invalidatesTags: (_result: any, _error: any, {id}: {id: string}) => [
            {id, type: `admin_${modelName}`},
            `admin_${modelName}`,
          ],
          query: ({id, body}: {id: string; body: any}) => ({
            body,
            method: "PATCH",
            url: `${routePath}/${id}`,
          }),
        }),
        [deleteKey]: build.mutation({
          invalidatesTags: [`admin_${modelName}`],
          query: (id: string) => ({
            method: "DELETE",
            url: `${routePath}/${id}`,
          }),
        }),
      }),
      overrideExisting: false,
    });
  }, [api, routePath, modelName]);

  // Extract the generated hooks dynamically
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const listKey = `adminList_${modelName}`;
  const readKey = `adminRead_${modelName}`;
  const createKey = `adminCreate_${modelName}`;
  const updateKey = `adminUpdate_${modelName}`;
  const deleteKey = `adminDelete_${modelName}`;

  return {
    useCreateMutation: (enhancedApi as any)[`use${capitalize(createKey)}Mutation`],
    useDeleteMutation: (enhancedApi as any)[`use${capitalize(deleteKey)}Mutation`],
    useListQuery: (enhancedApi as any)[`use${capitalize(listKey)}Query`],
    useReadQuery: (enhancedApi as any)[`use${capitalize(readKey)}Query`],
    useUpdateMutation: (enhancedApi as any)[`use${capitalize(updateKey)}Mutation`],
  };
};
