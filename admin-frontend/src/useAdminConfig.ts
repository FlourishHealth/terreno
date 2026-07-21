import {useMemo} from "react";
import {asDynamicHookApi} from "./dynamicHookApi";
import type {AdminApi, AdminConfigResponse, EndpointBuilder} from "./types";

const ENDPOINT_NAME = "adminConfig";

/**
 * Hook that fetches admin panel configuration from the backend.
 *
 * Dynamically injects a query endpoint into the provided RTK Query API to fetch
 * model metadata from `{baseUrl}/config`. Returns model configurations including
 * field types, required fields, references, and display settings.
 *
 * @param api - RTK Query API instance to inject the endpoint into
 * @param apiBase - Base URL where admin API requests are sent (e.g., "/admin")
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
export const useAdminConfig = (api: AdminApi, apiBase: string) => {
  const enhancedApi = useMemo(() => {
    return api.injectEndpoints({
      endpoints: (build: EndpointBuilder) => ({
        [ENDPOINT_NAME]: build.query({
          query: () => ({
            method: "GET",
            url: `${apiBase}/config`,
          }),
        }),
      }),
      overrideExisting: true,
    });
  }, [api, apiBase]);

  const useConfigQuery = asDynamicHookApi(enhancedApi).useAdminConfigQuery as () => {
    data?: AdminConfigResponse;
    error: unknown;
    isLoading: boolean;
  };

  const {data, isLoading, error} = useConfigQuery();

  return {config: data as AdminConfigResponse | null, error, isLoading};
};
