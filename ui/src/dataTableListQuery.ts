import type {DataTableColumn, DataTableColumnFilter, DataTableQueryParams} from "./Common";

/** Debounce delay for DataTable toolbar search before emitting query params. */
export const DATA_TABLE_SEARCH_DEBOUNCE_MS = 250;

/** Escape user input for case-insensitive MongoDB $regex literals. */
export const escapeRegexLiteral = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export interface BuildDataTableListQueryInput {
  columns: DataTableColumn[];
  filters?: DataTableColumnFilter[];
  filterValues?: Record<string, unknown>;
  search?: string;
  searchFields?: string[];
}

const isNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const parseNumberRange = (value: unknown): {$gte?: number; $lte?: number} | undefined => {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as {$gte?: unknown; $lte?: unknown; gte?: unknown; lte?: unknown};
  const range: {$gte?: number; $lte?: number} = {};
  const gte = record.$gte ?? record.gte;
  const lte = record.$lte ?? record.lte;
  if (typeof gte === "number" && !Number.isNaN(gte)) {
    range.$gte = gte;
  }
  if (typeof lte === "number" && !Number.isNaN(lte)) {
    range.$lte = lte;
  }
  return Object.keys(range).length > 0 ? range : undefined;
};

const parseChoiceValues = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).filter((entry) => entry !== "");
  }
  if (typeof value === "string" && value.trim() !== "") {
    return [value.trim()];
  }
  return [];
};

/**
 * Builds modelRouter-compatible list query params from DataTable search and filter state.
 * Omits empty values. Does not include page, limit, or sort.
 */
export const buildDataTableListQuery = ({
  columns,
  filters = [],
  filterValues = {},
  search = "",
  searchFields = [],
}: BuildDataTableListQueryInput): DataTableQueryParams => {
  const params: DataTableQueryParams = {};

  const declaredFilters = [
    ...columns
      .map((column) => column.filter)
      .filter((filter): filter is DataTableColumnFilter => Boolean(filter)),
    ...filters,
  ];
  for (const filter of declaredFilters) {
    const field = filter.field;

    if (filter.kind === "text") {
      const text = isNonEmptyString(filterValues[field]);
      if (text) {
        params[field] = {$options: "i", $regex: escapeRegexLiteral(text)};
      }
      continue;
    }

    if (filter.kind === "boolean") {
      const value = filterValues[field];
      if (value === true || value === false) {
        params[field] = value;
      }
      continue;
    }

    if (filter.kind === "dateRange") {
      const gte = isNonEmptyString(filterValues[`${field}_gte`]);
      const lte = isNonEmptyString(filterValues[`${field}_lte`]);
      if (gte) {
        params[`${field}_gte`] = gte;
      }
      if (lte) {
        params[`${field}_lte`] = lte;
      }
      continue;
    }

    if (filter.kind === "numberRange") {
      const range = parseNumberRange(filterValues[field]);
      if (range) {
        params[field] = range;
      }
      continue;
    }

    if (filter.kind === "choice") {
      const values = parseChoiceValues(filterValues[field]);
      if (values.length > 0) {
        params[field] = {$in: values};
      }
    }
  }

  const trimmedSearch = search.trim();
  if (trimmedSearch && searchFields.length > 0) {
    const escaped = escapeRegexLiteral(trimmedSearch);
    params.$or = searchFields.map((field) => ({
      [field]: {$options: "i", $regex: escaped},
    }));
  }

  return params;
};
