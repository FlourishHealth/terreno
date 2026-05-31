import {useMemo} from "react";
import type {AdminApi, EndpointBuilder} from "./types";

// biome-ignore lint/suspicious/noExplicitAny: payload bodies vary across admin models — handled at runtime
type AdminPayload = any;
// biome-ignore lint/suspicious/noExplicitAny: RTK Query tag callback args have a complex generic shape we erase here
type TagArg = any;

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
export const useAdminApi = (api: AdminApi, routePath: string, modelName: string) => {
  const enhancedApi = useMemo(() => {
    const listKey = `adminList_${modelName}`;
    const readKey = `adminRead_${modelName}`;
    const createKey = `adminCreate_${modelName}`;
    const updateKey = `adminUpdate_${modelName}`;
    const deleteKey = `adminDelete_${modelName}`;

    const tagType = `admin_${modelName}`;
    return api.enhanceEndpoints({addTagTypes: [tagType]}).injectEndpoints({
      endpoints: (build: EndpointBuilder) => ({
        [listKey]: build.query({
          providesTags: [`admin_${modelName}`],
          query: (params: Record<string, unknown> | undefined) => ({
            method: "GET",
            params: params ?? {},
            url: routePath,
          }),
        }),
        [readKey]: build.query({
          providesTags: (_result: TagArg, _error: TagArg, id: string) => [
            {id, type: `admin_${modelName}`},
          ],
          query: (id: string) => ({
            method: "GET",
            url: `${routePath}/${id}`,
          }),
        }),
        [createKey]: build.mutation({
          invalidatesTags: [`admin_${modelName}`],
          query: (body: AdminPayload) => ({
            body,
            method: "POST",
            url: routePath,
          }),
        }),
        [updateKey]: build.mutation({
          invalidatesTags: (_result: TagArg, _error: TagArg, {id}: {id: string}) => [
            {id, type: `admin_${modelName}`},
            `admin_${modelName}`,
          ],
          query: ({id, body}: {id: string; body: AdminPayload}) => ({
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

  // noExplicitAny: RTK Query generates hook names dynamically from endpoint keys; not statically expressible
  // biome-ignore lint/suspicious/noExplicitAny: dynamic hook lookup on RTK Query enhanced API
  const enhanced = enhancedApi as any;
  return {
    useCreateMutation: enhanced[`use${capitalize(createKey)}Mutation`],
    useDeleteMutation: enhanced[`use${capitalize(deleteKey)}Mutation`],
    useListQuery: enhanced[`use${capitalize(listKey)}Query`],
    useReadQuery: enhanced[`use${capitalize(readKey)}Query`],
    useUpdateMutation: enhanced[`use${capitalize(updateKey)}Mutation`],
  };
};
