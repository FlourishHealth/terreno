import type {Api} from "@reduxjs/toolkit/query/react";
import {useMemo} from "react";

/**
 * Hook that generates RTK Query CRUD hooks for a specific admin model.
 *
 * Dynamically injects endpoints for list, read, create, update, and delete operations
 * into the provided RTK Query API. Returns typed hooks for each operation with automatic
 * cache invalidation tags.
 *
 * @param api - RTK Query API instance to inject endpoints into
 * @param routePath - Full route path to the model's endpoints (e.g., "/admin/users")
 * @param modelName - Name of the model for cache tag generation (e.g., "User")
 * @returns Object with hooks: `useListQuery`, `useReadQuery`, `useCreateMutation`, `useUpdateMutation`, `useDeleteMutation`
 *
 * @example
 * ```typescript
 * import {useAdminApi} from "@terreno/admin-frontend";
 * import {api} from "@/store/openApiSdk";
 *
 * function UserList() {
 *   const {useListQuery, useCreateMutation, useDeleteMutation} = useAdminApi(
 *     api,
 *     "/admin/users",
 *     "User"
 *   );
 *
 *   const {data, isLoading} = useListQuery({limit: 20, page: 1});
 *   const [create, {isLoading: isCreating}] = useCreateMutation();
 *   const [deleteUser] = useDeleteMutation();
 *
 *   const handleCreate = async () => {
 *     await create({email: "test@example.com", name: "Test"}).unwrap();
 *   };
 *
 *   const handleDelete = async (id: string) => {
 *     await deleteUser(id).unwrap();
 *   };
 *
 *   return <DataTable data={data?.data} />;
 * }
 * ```
 *
 * @see useAdminConfig for fetching model configurations
 * @see AdminModelTable for usage in the table view
 */
export const useAdminApi = (api: Api<any, any, any, any>, routePath: string, modelName: string) => {
  const enhancedApi = useMemo(() => {
    const listKey = `adminList_${modelName}`;
    const readKey = `adminRead_${modelName}`;
    const createKey = `adminCreate_${modelName}`;
    const updateKey = `adminUpdate_${modelName}`;
    const deleteKey = `adminDelete_${modelName}`;

    const tagType = `admin_${modelName}`;
    return api.enhanceEndpoints({addTagTypes: [tagType]}).injectEndpoints({
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
      overrideExisting: true,
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
