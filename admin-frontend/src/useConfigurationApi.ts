import {useMemo} from "react";
import {asDynamicHookApi} from "./dynamicHookApi";
import type {AdminApi, EndpointBuilder} from "./types";

type ConfigBody = Record<string, unknown>;
type RtkHookResult = unknown;
type RtkMutationTrigger = (...args: unknown[]) => unknown;
type RtkError = unknown;

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

  const enhanced = asDynamicHookApi(enhancedApi);
  return {
    useMetaQuery: enhanced.useConfigMetaQuery,
    useRefreshSecretsMutation: enhanced.useConfigRefreshSecretsMutation,
    useUpdateMutation: enhanced.useConfigUpdateMutation,
    useValuesQuery: enhanced.useConfigValuesQuery,
  };
};
