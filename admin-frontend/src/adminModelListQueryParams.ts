import {
  buildDataTableListQuery,
  type DataTableColumn,
  type DataTableColumnFilter,
} from "@terreno/ui";

import type {AdminModelConfig} from "./types";

export const ADMIN_LIST_MAX_SELECTION = 1000;

export type AdminListFilterState = Record<string, string | boolean | string[] | undefined>;

const isEmptyFilterValue = (value: string | boolean | string[] | undefined): boolean => {
  if (value === undefined || value === "") {
    return true;
  }
  if (value === "all") {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return true;
  }
  return false;
};

/** Drops unset / "all" keys so draft vs applied comparison is stable. */
/** @internal */
export const compactAdminFilterState = (
  state: AdminListFilterState
): Record<string, string | boolean | string[]> => {
  const compacted: Record<string, string | boolean | string[]> = {};
  const keys = Object.keys(state).sort();
  for (const key of keys) {
    const value = state[key];
    if (isEmptyFilterValue(value)) {
      continue;
    }
    if (typeof value === "boolean") {
      compacted[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      compacted[key] = value;
      continue;
    }
    compacted[key] = String(value).trim();
    if (compacted[key] === "") {
      delete compacted[key];
    }
  }
  return compacted;
};

export const areAdminFilterStatesEqual = (
  left: AdminListFilterState,
  right: AdminListFilterState
): boolean => {
  return (
    JSON.stringify(compactAdminFilterState(left)) === JSON.stringify(compactAdminFilterState(right))
  );
};

export const adminFilterStateHasValues = (state: AdminListFilterState): boolean => {
  return Object.keys(compactAdminFilterState(state)).length > 0;
};

const toDataTableFilter = (
  filter: NonNullable<AdminModelConfig["filters"]>[number]
): DataTableColumnFilter | undefined => {
  if (filter.kind === "text") {
    return {field: filter.field, kind: "text"};
  }
  if (filter.kind === "boolean") {
    return {field: filter.field, kind: "boolean"};
  }
  if (filter.kind === "dateRange") {
    return {field: filter.field, kind: "dateRange"};
  }
  if (filter.kind === "choice") {
    return {
      field: filter.field,
      kind: "choice",
      options: filter.choices ?? [],
    };
  }
  return undefined;
};

const toDataTableColumns = (modelConfig: AdminModelConfig): DataTableColumn[] => {
  const filters = modelConfig.filters ?? [];
  return filters
    .filter((filter) => filter.kind !== "ref")
    .map((filter) => ({
      columnType: "text",
      filter: toDataTableFilter(filter),
      title: filter.field,
      width: 1,
    }));
};

/**
 * Builds query params for `GET` admin modelRouter list routes from UI state.
 */
export const buildAdminListQueryParams = (input: {
  filterState: AdminListFilterState;
  limit: number;
  modelConfig: AdminModelConfig;
  page: number;
  searchDebounced: string;
  sort?: string;
}): Record<string, unknown> => {
  const out: Record<string, unknown> = {
    limit: input.limit,
    page: input.page,
  };
  if (input.sort) {
    out.sort = input.sort;
  }

  const normalizedFilterValues: Record<string, unknown> = {...input.filterState};
  for (const filter of input.modelConfig.filters ?? []) {
    if (filter.kind !== "boolean") {
      continue;
    }
    const raw = normalizedFilterValues[filter.field];
    if (raw === "true" || raw === true) {
      normalizedFilterValues[filter.field] = true;
      continue;
    }
    if (raw === "false" || raw === false) {
      normalizedFilterValues[filter.field] = false;
    }
  }

  const tableQuery = buildDataTableListQuery({
    columns: toDataTableColumns(input.modelConfig),
    filterValues: normalizedFilterValues,
    search: "",
    searchFields: [],
  });
  for (const [key, value] of Object.entries(tableQuery)) {
    if (key === "$or") {
      continue;
    }
    out[key] = value;
  }

  for (const filter of input.modelConfig.filters ?? []) {
    if (filter.kind !== "ref") {
      continue;
    }
    const raw = input.filterState[filter.field];
    if (raw === undefined || raw === "") {
      continue;
    }
    out[filter.field] = String(raw);
  }

  const searchFields = input.modelConfig.searchFields ?? [];
  if (searchFields.length > 0 && input.searchDebounced.trim() !== "") {
    out.q = input.searchDebounced.trim();
  }

  return out;
};
