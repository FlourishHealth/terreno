import type {FilterDefinition, FilterValues} from "@terreno/ui";
import {getDateRangeValue} from "@terreno/ui";

import type {AdminModelConfig} from "./types";

export const ADMIN_LIST_MAX_SELECTION = 1000;

/**
 * Translates a model's admin config filters into the `FilterDefinition` list the
 * `Filter` component renders. Backend `ref` filters take an ObjectId string, so they
 * render as text with a hint.
 */
export const buildAdminFilterDefinitions = (modelConfig: AdminModelConfig): FilterDefinition[] => {
  return (modelConfig.filters ?? []).map((filter): FilterDefinition => {
    if (filter.kind === "boolean") {
      return {field: filter.field, kind: "boolean", label: filter.label};
    }
    if (filter.kind === "choice") {
      return {
        field: filter.field,
        kind: "choice",
        label: filter.label,
        options: filter.choices ?? [],
      };
    }
    if (filter.kind === "dateRange") {
      return {field: filter.field, kind: "dateRange", label: filter.label, type: "date"};
    }
    if (filter.kind === "ref") {
      return {
        field: filter.field,
        helperText: "Object ID",
        kind: "text",
        label: filter.label,
      };
    }
    return {field: filter.field, kind: "text", label: filter.label};
  });
};

/**
 * Builds query params for `GET` admin modelRouter list routes from UI state. Date
 * ranges become the `_gte`/`_lte` pair the backend's `queryFields` expose.
 */
export const buildAdminListQueryParams = (input: {
  filterState: FilterValues;
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
  const {filterState, modelConfig, searchDebounced} = input;

  for (const filter of modelConfig.filters ?? []) {
    const raw = filterState[filter.field];

    if (filter.kind === "dateRange") {
      const {from, to} = getDateRangeValue(raw);
      if (from?.trim()) {
        out[`${filter.field}_gte`] = from.trim();
      }
      if (to?.trim()) {
        out[`${filter.field}_lte`] = to.trim();
      }
      continue;
    }

    if (filter.kind === "boolean") {
      if (typeof raw === "boolean") {
        out[filter.field] = raw;
      }
      continue;
    }

    if (typeof raw === "string" && raw.trim() !== "") {
      out[filter.field] = raw.trim();
    }
  }

  const firstSearchField = modelConfig.searchFields?.[0];
  if (firstSearchField && searchDebounced.trim() !== "") {
    out[firstSearchField] = searchDebounced.trim();
  }
  return out;
};
