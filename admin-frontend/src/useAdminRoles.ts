import {useMemo} from "react";
import {asDynamicHookApi} from "./dynamicHookApi";
import type {AdminApi, EndpointBuilder} from "./types";

export interface RbacRoleRow {
  name: string;
  displayName: string;
  description?: string;
  isLocked?: boolean;
  isSealed?: boolean;
  permissions?: Record<string, string[]>;
}

/**
 * `@terreno/rtk`'s base query unwraps the `{data}` envelope for non-list responses, so the
 * hook receives a bare array. Apps wiring their own base query may still pass the envelope.
 */
export type RolesQueryData = RbacRoleRow[] | {data?: RbacRoleRow[]} | undefined;

export interface RolesQueryResult {
  data: RolesQueryData;
  isLoading: boolean;
  error: unknown;
  refetch?: () => void;
}

export const normalizeRoles = (data: RolesQueryData): RbacRoleRow[] => {
  if (Array.isArray(data)) {
    return data;
  }
  return data?.data ?? [];
};

const EMPTY_ROLES_HOOK = (): RolesQueryResult => ({
  data: undefined,
  error: null,
  isLoading: false,
});

/**
 * Roles are served by `rbacRouter`, which mounts at the API root rather than under the
 * admin base, so the admin base segment is trimmed before building the URL.
 */
const resolveRbacBase = (apiBase: string): string => apiBase.replace(/\/admin\/?$/, "");

export const useAdminRoles = (api: AdminApi, apiBase: string) => {
  const enhancedApi = useMemo(() => {
    // Guard: some call sites (and tests) pass a type-erased API double without
    // `injectEndpoints`. Return null so we can fall back to no-op hooks.
    if (typeof api?.injectEndpoints !== "function") {
      return null;
    }
    return api.injectEndpoints({
      endpoints: (build: EndpointBuilder) => ({
        // No providesTags: the list is read-only here, and an unregistered tag type
        // makes RTK Query log a console error in consumer apps.
        adminListRbacRoles: build.query({
          query: () => ({method: "GET", url: `${resolveRbacBase(apiBase)}/rbac/roles`}),
        }),
      }),
      overrideExisting: true,
    });
  }, [api, apiBase]);

  const enhanced = asDynamicHookApi(enhancedApi);

  return {
    useListRolesQuery: (enhanced?.useAdminListRbacRolesQuery ??
      EMPTY_ROLES_HOOK) as () => RolesQueryResult,
  };
};
