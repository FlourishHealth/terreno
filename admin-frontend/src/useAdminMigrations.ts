import {useMemo} from "react";
import {asDynamicHookApi} from "./dynamicHookApi";
import type {AdminApi, EndpointBuilder} from "./types";

interface MigrationStatusRecord {
  appliedAt?: string;
  checksum: string;
  id: string;
}

interface MigrationLockStatus {
  expiresAt: string;
  holder: string;
}

interface AdminMigrationStatus {
  applied: MigrationStatusRecord[];
  lock: MigrationLockStatus | null;
  pending: Array<{checksum: string; id: string}>;
}

interface MigrationQueryResult {
  data: AdminMigrationStatus | undefined;
  error: unknown;
  isLoading: boolean;
  refetch?: () => void;
}

const EMPTY_STATUS_HOOK = (): MigrationQueryResult => ({
  data: undefined,
  error: null,
  isLoading: false,
});

export const useAdminMigrations = (api: AdminApi, apiBase: string) => {
  const enhancedApi = useMemo(() => {
    if (typeof api?.injectEndpoints !== "function") {
      return null;
    }
    return api.enhanceEndpoints({addTagTypes: ["admin_migrations"]}).injectEndpoints({
      endpoints: (build: EndpointBuilder) => ({
        adminGetMigrations: build.query({
          providesTags: ["admin_migrations"],
          query: () => ({
            method: "GET",
            url: `${apiBase}/migrations/status`,
          }),
        }),
        adminRunMigrations: build.mutation({
          invalidatesTags: ["admin_migrations"],
          query: ({wetRun}: {wetRun: boolean}) => ({
            method: "POST",
            url: `${apiBase}/migrations/run?wetRun=${wetRun}`,
          }),
        }),
      }),
      overrideExisting: true,
    });
  }, [api, apiBase]);

  const enhanced = asDynamicHookApi(enhancedApi);

  return {
    useGetMigrationsQuery: (enhanced?.useAdminGetMigrationsQuery ?? EMPTY_STATUS_HOOK) as (
      arg?: undefined,
      options?: {skip?: boolean; pollingInterval?: number}
    ) => MigrationQueryResult,
    useRunMigrationsMutation: (enhanced?.useAdminRunMigrationsMutation ??
      (() => [
        () => ({unwrap: () => Promise.resolve({taskId: ""})}),
        {isLoading: false},
      ])) as () => [
      (args: {wetRun: boolean}) => {unwrap: () => Promise<{taskId: string}>},
      {isLoading: boolean},
    ],
  };
};
