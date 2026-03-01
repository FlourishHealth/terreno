import type {Api} from "@reduxjs/toolkit/query/react";
import {useMemo} from "react";
import type {AdminConfigResponse} from "./types";

const ENDPOINT_NAME = "adminConfig";

export const useAdminConfig = (api: Api<any, any, any, any>, baseUrl: string) => {
  const enhancedApi = useMemo(() => {
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

  const {data, isLoading, error} = useConfigQuery();

  return {config: data as AdminConfigResponse | null, error, isLoading};
};
