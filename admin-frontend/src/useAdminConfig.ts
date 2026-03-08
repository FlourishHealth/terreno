import type {Api} from "@reduxjs/toolkit/query/react";
import {useMemo} from "react";
import type {AdminConfigResponse} from "./types";

const ENDPOINT_NAME = "adminConfig";

/**
 * Hook that fetches admin panel configuration from the backend.
 *
 * Dynamically injects a query endpoint into the provided RTK Query API to fetch
 * model metadata from `{baseUrl}/config`. Returns model configurations including
 * field types, required fields, references, and display settings.
 *
 * @param api - RTK Query API instance to inject the endpoint into
 * @param baseUrl - Base URL for admin routes (e.g., "/admin")
 * @returns Object with `config` (model metadata), `isLoading`, and `error`
 *
 * @example
 * ```typescript
 * import {useAdminConfig} from "@terreno/admin-frontend";
 * import {api} from "@/store/openApiSdk";
 *
 * function AdminScreen() {
 *   const {config, isLoading, error} = useAdminConfig(api, "/admin");
 *
 *   if (isLoading) return <Spinner />;
 *   if (error || !config) return <Text>Error loading config</Text>;
 *
 *   return <div>{config.models.map(m => <Card key={m.name}>{m.displayName}</Card>)}</div>;
 * }
 * ```
 *
 * @see AdminConfigResponse for the returned configuration structure
 * @see AdminModelList for usage in the model list screen
 */
export const useAdminConfig = (api: Api<any, any, any, any>, baseUrl: string) => {
  console.info("[useAdminConfig] called with baseUrl:", baseUrl);

  const enhancedApi = useMemo(() => {
    console.info("[useAdminConfig] injecting endpoint for", `${baseUrl}/config`);
    return api.injectEndpoints({
      endpoints: (build: any) => ({
        [ENDPOINT_NAME]: build.query({
          query: () => ({
            method: "GET",
            url: `${baseUrl}/config`,
          }),
        }),
      }),
      overrideExisting: true,
    });
  }, [api, baseUrl]);

  const useConfigQuery = (enhancedApi as any).useAdminConfigQuery;
  console.info("[useAdminConfig] useConfigQuery hook exists:", !!useConfigQuery);

  const {data, isLoading, error} = useConfigQuery();
  console.info("[useAdminConfig] state:", {error, hasData: !!data, hasError: !!error, isLoading});

  return {config: data as AdminConfigResponse | null, error, isLoading};
};
