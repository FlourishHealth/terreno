import startCase from "lodash/startCase";
import {DateTime} from "luxon";

import type {
  ActiveFilter,
  FilterDateRangeValue,
  FilterDefinition,
  FilterFieldValue,
  FilterNumberRangeValue,
  FilterValues,
} from "./Common";

/** The label a filter shows, falling back to a title-cased `field`. */
export const getFilterLabel = (definition: FilterDefinition): string => {
  return definition.label ?? startCase(definition.field);
};

const isDateRangeValue = (value: FilterFieldValue): value is FilterDateRangeValue => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isNumberRangeValue = (value: FilterFieldValue): value is FilterNumberRangeValue => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

/** Read a `dateRange` value defensively — consumers hold the record, so it may be malformed. */
export const getDateRangeValue = (value: FilterFieldValue): FilterDateRangeValue => {
  if (!isDateRangeValue(value)) {
    return {};
  }
  return {
    from: typeof value.from === "string" ? value.from : undefined,
    to: typeof value.to === "string" ? value.to : undefined,
  };
};

/** Read a `numberRange` value defensively — consumers hold the record, so it may be malformed. */
export const getNumberRangeValue = (value: FilterFieldValue): FilterNumberRangeValue => {
  if (!isNumberRangeValue(value)) {
    return {};
  }
  const from = (value as FilterNumberRangeValue).from;
  const to = (value as FilterNumberRangeValue).to;
  return {
    from: typeof from === "number" && Number.isFinite(from) ? from : undefined,
    to: typeof to === "number" && Number.isFinite(to) ? to : undefined,
  };
};

/** Read a `multiChoice` value defensively, dropping anything that is not a string. */
export const getMultiChoiceValue = (value: FilterFieldValue): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
};

const formatDate = (iso: string, withTime: boolean): string => {
  const parsed = DateTime.fromISO(iso);
  if (!parsed.isValid) {
    return iso;
  }
  return parsed.toLocaleString(withTime ? DateTime.DATETIME_MED : DateTime.DATE_MED);
};

/** Whether a filter currently constrains results. */
export const isFilterActive = (input: {
  definition: FilterDefinition;
  value: FilterFieldValue;
}): boolean => {
  const {definition, value} = input;
  switch (definition.kind) {
    case "boolean":
      return typeof value === "boolean";
    case "choice":
    case "text":
      return typeof value === "string" && value.trim() !== "";
    case "multiChoice":
      return getMultiChoiceValue(value).length > 0;
    case "dateRange": {
      const range = getDateRangeValue(value);
      return Boolean(range.from) || Boolean(range.to);
    }
    case "numberRange": {
      const range = getNumberRangeValue(value);
      return range.from !== undefined || range.to !== undefined;
    }
    default:
      return false;
  }
};

/**
 * Flatten the applied filters into one entry per chip. `multiChoice` produces one entry
 * per selected option so each can be dismissed on its own.
 */
export const getActiveFilters = (input: {
  filters: FilterDefinition[];
  values: FilterValues;
}): ActiveFilter[] => {
  const {filters, values} = input;
  const active: ActiveFilter[] = [];

  for (const definition of filters) {
    const value = values[definition.field];
    if (!isFilterActive({definition, value})) {
      continue;
    }
    const label = getFilterLabel(definition);

    if (definition.kind === "boolean") {
      active.push({
        field: definition.field,
        label,
        value: value === true ? (definition.trueLabel ?? "Yes") : (definition.falseLabel ?? "No"),
      });
      continue;
    }

    if (definition.kind === "choice") {
      const selected = definition.options.find((option) => option.value === value);
      active.push({field: definition.field, label, value: selected?.label ?? String(value)});
      continue;
    }

    if (definition.kind === "multiChoice") {
      for (const optionValue of getMultiChoiceValue(value)) {
        const selected = definition.options.find((option) => option.value === optionValue);
        active.push({
          field: definition.field,
          label,
          optionValue,
          value: selected?.label ?? optionValue,
        });
      }
      continue;
    }

    if (definition.kind === "dateRange") {
      const range = getDateRangeValue(value);
      const withTime = definition.type === "datetime";
      const from = range.from ? formatDate(range.from, withTime) : undefined;
      const to = range.to ? formatDate(range.to, withTime) : undefined;
      let summary = `${from} – ${to}`;
      if (!to) {
        summary = `On or after ${from}`;
      } else if (!from) {
        summary = `On or before ${to}`;
      }
      active.push({field: definition.field, label, value: summary});
      continue;
    }

    if (definition.kind === "numberRange") {
      const range = getNumberRangeValue(value);
      let summary = `${range.from} – ${range.to}`;
      if (range.to === undefined) {
        summary = `${range.from} or more`;
      } else if (range.from === undefined) {
        summary = `${range.to} or less`;
      }
      active.push({field: definition.field, label, value: summary});
      continue;
    }

    active.push({field: definition.field, label, value: String(value)});
  }

  return active;
};

/** How many chips `getActiveFilters` would render. */
export const countActiveFilters = (input: {
  filters: FilterDefinition[];
  values: FilterValues;
}): number => {
  return getActiveFilters(input).length;
};

/** The empty value for a filter kind, used when clearing. */
export const getEmptyFilterValue = (definition: FilterDefinition): FilterFieldValue => {
  switch (definition.kind) {
    case "multiChoice":
      return [];
    case "dateRange":
    case "numberRange":
      return {};
    case "choice":
    case "text":
      return "";
    default:
      return undefined;
  }
};

/**
 * Reset every clearable field owned by `filters`. Keys the caller stores for other purposes
 * are left untouched, and disabled filters are preserved so clear-all cannot change a value
 * the user is not allowed to edit.
 */
export const clearFilterValues = (input: {
  filters: FilterDefinition[];
  values: FilterValues;
}): FilterValues => {
  const next: FilterValues = {...input.values};
  for (const definition of input.filters) {
    if (definition.disabled) {
      continue;
    }
    next[definition.field] = getEmptyFilterValue(definition);
  }
  return next;
};

/**
 * Reset a single filter. For `multiChoice`, passing `optionValue` removes only that
 * option and leaves the rest selected.
 */
export const clearFilterField = (input: {
  definition: FilterDefinition;
  optionValue?: string;
  values: FilterValues;
}): FilterValues => {
  const {definition, optionValue, values} = input;
  if (definition.kind === "multiChoice" && optionValue !== undefined) {
    const remaining = getMultiChoiceValue(values[definition.field]).filter(
      (entry) => entry !== optionValue
    );
    return {...values, [definition.field]: remaining};
  }
  return {...values, [definition.field]: getEmptyFilterValue(definition)};
};
