import type {Api} from "@reduxjs/toolkit/query/react";
import {useMemo} from "react";

interface UseConfigurationApiOptions {
  api: Api<any, any, any, any>;
  basePath: string;
}

interface UseConfigurationApiResult {
  useMetaQuery: () => {data: any; isLoading: boolean; error: any};
  useRefreshSecretsMutation: () => [any, {isLoading: boolean}];
  useUpdateMutation: () => [any, {isLoading: boolean}];
  useValuesQuery: () => {data: any; isLoading: boolean; error: any};
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
      endpoints: (build: any) => ({
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
          query: (body: any) => ({
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

  return {
    useMetaQuery: (enhancedApi as any).useConfigMetaQuery,
    useRefreshSecretsMutation: (enhancedApi as any).useConfigRefreshSecretsMutation,
    useUpdateMutation: (enhancedApi as any).useConfigUpdateMutation,
    useValuesQuery: (enhancedApi as any).useConfigValuesQuery,
  };
};
