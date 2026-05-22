import {useMemo} from "react";
import type {AdminApi, EndpointBuilder} from "./types";

// The configuration document shape varies per consumer — different apps register different
// configuration sections via @terreno/api's Configuration model.
// biome-ignore lint/suspicious/noExplicitAny: configuration values are heterogeneous per consumer
type ConfigBody = any;
// biome-ignore lint/suspicious/noExplicitAny: RTK Query's hook return shape varies per endpoint
type RtkHookResult = any;
// biome-ignore lint/suspicious/noExplicitAny: RTK Query's mutation trigger has a complex generic shape
type RtkMutationTrigger = any;
// biome-ignore lint/suspicious/noExplicitAny: RTK Query's error union type erases at the hook boundary
type RtkError = any;

interface UseConfigurationApiOptions {
  api: AdminApi;
  basePath: string;
}

interface UseConfigurationApiResult {
  useMetaQuery: () => {data: RtkHookResult; isLoading: boolean; error: RtkError};
  useRefreshSecretsMutation: () => [RtkMutationTrigger, {isLoading: boolean}];
  useUpdateMutation: () => [RtkMutationTrigger, {isLoading: boolean}];
  useValuesQuery: () => {data: RtkHookResult; isLoading: boolean; error: RtkError};
}

/**
 * Hook that generates RTK Query hooks for configuration management.
 *
 * Dynamically injects endpoints for:
 * - `meta` — GET `{basePath}/meta` (schema metadata)
 * - `values` — GET `{basePath}` (current configuration values)
 * - `update` — PATCH `{basePath}` (update configuration)
 * - `refreshSecrets` — POST `{basePath}/refresh-secrets` (trigger secret refresh)
 */
export const useConfigurationApi = ({
  api,
  basePath,
}: UseConfigurationApiOptions): UseConfigurationApiResult => {
  const enhancedApi = useMemo(() => {
    return api.enhanceEndpoints({addTagTypes: ["configuration"]}).injectEndpoints({
      endpoints: (build: EndpointBuilder) => ({
        configMeta: build.query({
          query: () => ({
            method: "GET",
            url: `${basePath}/meta`,
          }),
        }),
        configRefreshSecrets: build.mutation({
          query: () => ({
            method: "POST",
            url: `${basePath}/refresh-secrets`,
          }),
        }),
        configUpdate: build.mutation({
          invalidatesTags: ["configuration"],
          query: (body: ConfigBody) => ({
            body,
            method: "PATCH",
            url: basePath,
          }),
        }),
        configValues: build.query({
          providesTags: ["configuration"],
          query: () => ({
            method: "GET",
            url: basePath,
          }),
        }),
      }),
      overrideExisting: true,
    });
  }, [api, basePath]);

  // biome-ignore lint/suspicious/noExplicitAny: dynamic hook lookup on RTK Query enhanced API
  const enhanced = enhancedApi as any;
  return {
    useMetaQuery: enhanced.useConfigMetaQuery,
    useRefreshSecretsMutation: enhanced.useConfigRefreshSecretsMutation,
    useUpdateMutation: enhanced.useConfigUpdateMutation,
    useValuesQuery: enhanced.useConfigValuesQuery,
  };
};
