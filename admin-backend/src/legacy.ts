import type {AdminConfig} from "@terreno/api";
import {logger} from "@terreno/api";

import type {AdminModelConfig} from "./adminApp";
import type {ResolvedAdminModel} from "./resolvedAdminModel";
import {normalizeAdminRoutePath} from "./routePath";

const warnedLegacyKeys = new Set<string>();

const legacyWarningKey = (config: AdminModelConfig): string => {
  return `${config.model.modelName}:${normalizeAdminRoutePath(config.routePath)}`;
};

/**
 * Converts legacy `AdminApp.models[]` entries into resolved admin models and emits a
 * one-time deprecation warning per model/routePath per process.
 */
export const convertLegacyModelConfig = (config: AdminModelConfig): ResolvedAdminModel => {
  const key = legacyWarningKey(config);
  if (!warnedLegacyKeys.has(key)) {
    warnedLegacyKeys.add(key);
    logger.warn(
      `[admin] AdminApp.models entry "${config.displayName}" uses the legacy shape (model=${config.model.modelName}, routePath=${config.routePath}). Migrate to modelRouter({admin: {...}}) — see docs/how-to/admin-add-model.md`
    );
  }

  const admin: AdminConfig = {
    actions: config.actions,
    autocompleteFields: undefined,
    bulkPatchAllowlist: config.bulkPatchAllowlist,
    defaultSort: config.defaultSort,
    displayName: config.displayName,
    excludeFields: undefined,
    fieldOrder: config.fieldOrder,
    fieldOverrides: config.fieldOverrides,
    fieldsets: config.fieldsets,
    filters: config.filters,
    group: config.group,
    hiddenFields: config.hiddenFields,
    listDisplay: config.listDisplay,
    listDisplayLinks: config.listDisplayLinks,
    listFields: config.listFields,
    pageSize: config.pageSize,
    readonlyFields: config.readonlyFields,
    realtime: config.realtime,
    recordTitleField: config.recordTitleField,
    searchFields: config.searchFields,
    sortableFields: config.sortableFields,
  };

  return {
    ...config,
    admin,
    routePath: normalizeAdminRoutePath(config.routePath),
    source: "legacy",
    sourceLabel: config.displayName,
  };
};

/** @internal Test helper — clears one-time legacy deprecation warnings. */
export const resetLegacyDeprecationWarningsForTests = (): void => {
  warnedLegacyKeys.clear();
};
