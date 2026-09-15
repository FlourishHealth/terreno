import type {DataTableColumn, DataTableColumnFilter, DataTableQueryParams} from "./Common";

/** Debounce delay for DataTable toolbar search before emitting query params. */
export const DATA_TABLE_SEARCH_DEBOUNCE_MS = 250;

/**
 * Wire-format sentinel for optional choice filters meaning "field is null or unset".
 * Must match `ADMIN_LIST_CHOICE_EMPTY_VALUE` in `@terreno/api`.
 */
export const DATA_TABLE_CHOICE_EMPTY_VALUE = "__empty__";

export const DATA_TABLE_CHOICE_EMPTY_LABEL = "Empty";

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

const splitChoiceValues = (
  values: string[],
  allowEmpty: boolean
): {concrete: string[]; includeEmpty: boolean} => {
  const includeEmpty = allowEmpty && values.includes(DATA_TABLE_CHOICE_EMPTY_VALUE);
  const concrete = values.filter(
    (entry) => entry !== DATA_TABLE_CHOICE_EMPTY_VALUE && entry !== ""
  );
  return {concrete, includeEmpty};
};

/**
 * Builds a modelRouter-compatible choice filter value.
 *
 * Contract:
 * - concrete only, one value → scalar equality
 * - concrete only, many values → `{ $in: concrete[] }`
 * - empty only → `{ $in: [DATA_TABLE_CHOICE_EMPTY_VALUE] }` (parsed server-side to null)
 * - empty + concrete → `{ $in: [...concrete, DATA_TABLE_CHOICE_EMPTY_VALUE] }`
 */
export const buildChoiceFilterQueryValue = (
  values: string[],
  allowEmpty = false
): string | {$in: string[]} | undefined => {
  const {concrete, includeEmpty} = splitChoiceValues(values, allowEmpty);
  if (!includeEmpty && concrete.length === 0) {
    return undefined;
  }
  if (includeEmpty && concrete.length === 0) {
    return {$in: [DATA_TABLE_CHOICE_EMPTY_VALUE]};
  }
  if (!includeEmpty && concrete.length === 1) {
    return concrete[0];
  }
  if (!includeEmpty) {
    return {$in: concrete};
  }
  return {$in: [...concrete, DATA_TABLE_CHOICE_EMPTY_VALUE]};
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
      const queryValue = buildChoiceFilterQueryValue(values, filter.allowEmpty === true);
      if (queryValue !== undefined) {
        params[field] = queryValue;
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
