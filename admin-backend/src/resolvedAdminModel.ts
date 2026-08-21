import type {AdminConfig, ModelRouterOptions, PopulatePath} from "@terreno/api";
import type {Model} from "mongoose";

import type {AdminModelConfig} from "./adminApp";
import type {AdminListFilter, AdminModelPermissionsInput} from "./adminUiV2";
import {normalizeAdminRoutePath} from "./routePath";

export type AdminModelSource = "legacy" | "plugin" | "registered";

export interface ResolvedAdminModel extends AdminModelConfig {
  admin: AdminConfig;
  source: AdminModelSource;
  sourceLabel: string;
  registrationPath?: string;
  excludeFields?: string[];
  autocompleteFields?: string[];
  icon?: string;
}

const adminPermissionsToModelPermissions = (
  permissions?: AdminConfig["adminPermissions"]
): AdminModelPermissionsInput | undefined => {
  if (!permissions) {
    return undefined;
  }
  const has = (methods: typeof permissions.create): boolean => {
    return methods != null && methods.length > 0;
  };
  const mapped: AdminModelPermissionsInput = {};
  if (permissions.create !== undefined) {
    mapped.create = has(permissions.create);
  }
  if (permissions.delete !== undefined) {
    mapped.delete = has(permissions.delete);
  }
  if (permissions.update !== undefined) {
    mapped.update = has(permissions.update);
  }
  return mapped;
};

const adminFilterToQueryFilter = (
  adminFilter?: AdminConfig["adminFilter"]
): AdminModelConfig["queryFilter"] | undefined => {
  if (!adminFilter) {
    return undefined;
  }
  return async (user, query) => {
    const stubReq = {user} as import("express").Request;
    const scoped = await adminFilter(stubReq);
    return {...(query ?? {}), ...scoped};
  };
};

export const resolvedModelFromAdminConfig = ({
  admin,
  model,
  populatePaths,
  queryFilter,
  registrationPath,
  routePath,
  source,
  sourceLabel,
}: {
  admin: AdminConfig;
  model: Model<unknown>;
  populatePaths?: PopulatePath[];
  queryFilter?: ModelRouterOptions<unknown>["queryFilter"];
  registrationPath?: string;
  routePath: string;
  source: AdminModelSource;
  sourceLabel: string;
}): ResolvedAdminModel => {
  const normalizedPath = normalizeAdminRoutePath(routePath);
  const defaultSort = Array.isArray(admin.defaultSort)
    ? admin.defaultSort.join(" ")
    : admin.defaultSort;

  const mergedQueryFilter = queryFilter ?? adminFilterToQueryFilter(admin.adminFilter);

  return {
    actions: admin.actions,
    admin,
    autocompleteFields: admin.autocompleteFields,
    bulkPatchAllowlist: admin.bulkPatchAllowlist,
    defaultSort,
    displayName: admin.displayName,
    excludeFields: admin.excludeFields,
    fieldOrder: admin.fieldOrder,
    fieldOverrides: admin.fieldOverrides,
    fieldsets: admin.fieldsets,
    filters: admin.filters as AdminListFilter[] | undefined,
    group: admin.group,
    hiddenFields: admin.hiddenFields,
    icon: admin.icon,
    listDisplay: admin.listDisplay,
    listDisplayLinks: admin.listDisplayLinks,
    listFields: admin.listFields,
    model,
    pageSize: admin.pageSize,
    permissions: adminPermissionsToModelPermissions(admin.adminPermissions),
    populatePaths,
    queryFilter: mergedQueryFilter,
    readonlyFields: admin.readonlyFields,
    realtime: admin.realtime,
    recordTitleField: admin.recordTitleField,
    registrationPath,
    routePath: normalizedPath,
    searchFields: admin.searchFields,
    sortableFields: admin.sortableFields,
    source,
    sourceLabel,
  };
};
