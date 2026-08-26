import {useMemo} from "react";
import {useSelector} from "react-redux";

import type {RootState} from "./constants";

export interface PermissionSet {
  [resource: string]: readonly string[];
}

export interface PermissionRequest {
  [resource: string]: string[];
}

export const DEFAULT_PERMISSION_API_REDUCER_PATH = "terreno-rtk";

interface QueryCacheEntry {
  data?: {permissions?: PermissionSet};
  endpointName?: string;
  status?: string;
}

const isMePermissionsQuery = (endpointName: string | undefined, cacheKey: string): boolean => {
  if (endpointName) {
    if (/getMe|getProfile|authMe/i.test(endpointName)) {
      return true;
    }
  }
  return /getMe|auth\/me|getProfile/i.test(cacheKey);
};

export const hasPermission = (
  permissions: PermissionSet | undefined,
  request: PermissionRequest
): boolean => {
  if (!permissions) {
    return false;
  }

  for (const [resource, actions] of Object.entries(request)) {
    const granted = permissions[resource] ?? [];
    for (const action of actions ?? []) {
      if (!granted.includes(action)) {
        return false;
      }
    }
  }

  return true;
};

/** Resource/action that opens the admin panel. Other admin permissions do not grant entry. */
export const ADMIN_PAGE_RESOURCE = "admin";
export const ADMIN_PAGE_ACTION = "access";
export const ADMIN_PAGE_PERMISSION: PermissionRequest = {
  [ADMIN_PAGE_RESOURCE]: [ADMIN_PAGE_ACTION],
};

/**
 * Decide whether the signed-in user may open the admin UI.
 * With RBAC (`permissions` present), only `admin:access` grants entry.
 * Without RBAC, fall back to the legacy `user.admin` flag.
 */
export const canOpenAdminPage = ({
  admin,
  permissions,
}: {
  admin?: boolean;
  permissions?: PermissionSet;
}): boolean => {
  if (permissions) {
    return hasPermission(permissions, ADMIN_PAGE_PERMISSION);
  }
  return admin === true;
};

export const createPermissionSelectors = (api: {reducerPath: string}) => {
  const selectPermissions = (state: RootState): PermissionSet | undefined => {
    const auth = (state as {auth?: {userId?: string | null}}).auth;
    if (auth && !auth.userId) {
      return undefined;
    }

    const apiState = (
      state as Record<string, {queries?: Record<string, QueryCacheEntry>} | undefined>
    )[api.reducerPath];
    const queries = apiState?.queries;
    if (!queries) {
      return undefined;
    }

    for (const [cacheKey, entry] of Object.entries(queries)) {
      if (entry?.status && entry.status !== "fulfilled") {
        continue;
      }
      const permissions = entry?.data?.permissions;
      if (!permissions) {
        continue;
      }
      if (!isMePermissionsQuery(entry.endpointName, cacheKey)) {
        continue;
      }
      return permissions;
    }

    return undefined;
  };

  const useSelectPermissions = (): PermissionSet | undefined => useSelector(selectPermissions);

  const useCan = (request: PermissionRequest): boolean => {
    const permissions = useSelectPermissions();
    return useMemo(() => hasPermission(permissions, request), [permissions, request]);
  };

  return {selectPermissions, useCan, useSelectPermissions};
};

const defaultPermissionSelectors = createPermissionSelectors({
  reducerPath: DEFAULT_PERMISSION_API_REDUCER_PATH,
});

export const selectPermissions = defaultPermissionSelectors.selectPermissions;
export const useSelectPermissions = defaultPermissionSelectors.useSelectPermissions;
export const useCan = defaultPermissionSelectors.useCan;
