import type {AdminModelConfig} from "./types";

export const ADMIN_LIST_MAX_SELECTION = 1000;

export type AdminListFilterState = Record<string, string | boolean | undefined>;

const isEmptyFilterValue = (value: string | boolean | undefined): boolean => {
  if (value === undefined || value === "") {
    return true;
  }
  if (value === "all") {
    return true;
  }
  return false;
};

/** Drops unset / "all" keys so draft vs applied comparison is stable. */
export const compactAdminFilterState = (
  state: AdminListFilterState
): Record<string, string | boolean> => {
  const compacted: Record<string, string | boolean> = {};
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
  const {filterState, modelConfig, searchDebounced} = input;
  const filters = modelConfig.filters ?? [];
  for (const f of filters) {
    if (f.kind === "dateRange") {
      const gteKey = `${f.field}_gte`;
      const lteKey = `${f.field}_lte`;
      const gteVal = filterState[gteKey];
      const lteVal = filterState[lteKey];
      if (gteVal !== undefined && String(gteVal).trim() !== "") {
        out[gteKey] = String(gteVal).trim();
      }
      if (lteVal !== undefined && String(lteVal).trim() !== "") {
        out[lteKey] = String(lteVal).trim();
      }
      continue;
    }
    const raw = filterState[f.field];
    if (raw === undefined || raw === "") {
      continue;
    }
    if (f.kind === "boolean") {
      if (raw === "all") {
        continue;
      }
      out[f.field] = raw === true || raw === "true";
      continue;
    }
    if (f.kind === "choice" || f.kind === "text" || f.kind === "ref") {
      out[f.field] = String(raw);
    }
  }
  const searchFields = modelConfig.searchFields ?? [];
  if (searchFields.length > 0 && searchDebounced.trim() !== "") {
    out.q = searchDebounced.trim();
  }
  return out;
};
