import {useMemo} from "react";
import {useSelector} from "react-redux";

import type {RootState} from "./constants";

export interface PermissionSet {
  [resource: string]: readonly string[];
}

export interface PermissionRequest {
  [resource: string]: string[];
}

export const hasPermission = (
  permissions: PermissionSet | undefined,
  request: PermissionRequest,
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

export const selectPermissions = (state: RootState): PermissionSet | undefined => {
  const profile = state as RootState & {
    terrenoApi?: {queries?: Record<string, {data?: {permissions?: PermissionSet}}>};
  };
  const queries = profile.terrenoApi?.queries ?? {};
  for (const entry of Object.values(queries)) {
    const permissions = entry?.data?.permissions;
    if (permissions) {
      return permissions;
    }
  }
  return undefined;
};

export const useSelectPermissions = (): PermissionSet | undefined =>
  useSelector(selectPermissions);

export const useCan = (request: PermissionRequest): boolean => {
  const permissions = useSelectPermissions();
  return useMemo(() => hasPermission(permissions, request), [permissions, request]);
};
