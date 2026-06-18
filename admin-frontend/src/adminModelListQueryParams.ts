import type {AdminModelConfig} from "./types";

export const ADMIN_LIST_MAX_SELECTION = 1000;

export type AdminListFilterState = Record<string, string | boolean | undefined>;

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
    const raw = filterState[f.field];
    if (raw === undefined || raw === "") {
      continue;
    }
    if (f.kind === "boolean") {
      out[f.field] = raw === true || raw === "true";
      continue;
    }
    if (f.kind === "choice" || f.kind === "text" || f.kind === "ref") {
      out[f.field] = String(raw);
    }
  }
  const firstSearchField = modelConfig.searchFields?.[0];
  if (firstSearchField && searchDebounced.trim() !== "") {
    out[firstSearchField] = searchDebounced.trim();
  }
  return out;
};
