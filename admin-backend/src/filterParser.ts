import type {AdminFilter} from "@terreno/api";
import {logger} from "@terreno/api";
import {DateTime} from "luxon";
import mongoose from "mongoose";

const POLLUTION_KEYS = new Set(["__proto__", "constructor", "prototype"]);

const isOperatorKey = (key: string): boolean => {
  return key.startsWith("$");
};

const dropPollutionKeys = (query: Record<string, unknown>): Record<string, unknown> => {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (POLLUTION_KEYS.has(key)) {
      logger.warn(`[admin] Dropping prototype-pollution query key: ${key}`);
      continue;
    }
    next[key] = value;
  }
  return next;
};

const scalarString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
};

const parseBooleanFilter = (
  field: string,
  value: unknown
): {ok: true; value: boolean} | {ok: false; error: string} => {
  const scalar = scalarString(value);
  if (scalar === "true") {
    return {ok: true, value: true};
  }
  if (scalar === "false") {
    return {ok: true, value: false};
  }
  return {error: `${field} must be true or false`, ok: false};
};

const parseTextFilter = (
  field: string,
  value: unknown
): {ok: true; value: string} | {ok: false; error: string} => {
  const scalar = scalarString(value);
  if (
    scalar === undefined ||
    Array.isArray(value) ||
    (value != null && typeof value === "object")
  ) {
    return {error: `${field} must be a string`, ok: false};
  }
  return {ok: true, value: scalar};
};

const parseChoiceFilter = (
  field: string,
  value: unknown,
  choices: {label: string; value: string}[]
): {ok: true; value: string} | {ok: false; error: string} => {
  const parsed = parseTextFilter(field, value);
  if (!parsed.ok) {
    return parsed;
  }
  const allowed = new Set(choices.map((choice) => choice.value));
  if (!allowed.has(parsed.value)) {
    return {error: `${field} must be one of: ${[...allowed].join(", ")}`, ok: false};
  }
  return parsed;
};

const parseRefFilter = (
  field: string,
  value: unknown
): {ok: true; value: string} | {ok: false; error: string} => {
  const parsed = parseTextFilter(field, value);
  if (!parsed.ok) {
    return parsed;
  }
  if (!mongoose.isValidObjectId(parsed.value)) {
    return {error: `${field} must be a valid id`, ok: false};
  }
  return parsed;
};

const parseIsoDate = (
  field: string,
  value: unknown
): {ok: true; value: Date} | {ok: false; error: string} => {
  const scalar = scalarString(value);
  if (
    scalar === undefined ||
    Array.isArray(value) ||
    (value != null && typeof value === "object")
  ) {
    return {error: `${field} must be an ISO date string`, ok: false};
  }
  const parsed = DateTime.fromISO(scalar, {zone: "utc"});
  if (!parsed.isValid) {
    return {error: `${field} must be an ISO date string`, ok: false};
  }
  return {ok: true, value: parsed.toJSDate()};
};

export interface ParseAdminListFiltersResult {
  consumedKeys: Set<string>;
  errors: Record<string, string>;
  filter: Record<string, unknown>;
}

/**
 * Parses v2-compatible list query params for declared admin filters.
 * Undeclared keys are ignored; Mongo operator keys are rejected.
 */
export const parseAdminListFilters = (
  query: Record<string, unknown>,
  filters: AdminFilter[] = []
): ParseAdminListFiltersResult => {
  const safeQuery = dropPollutionKeys(query);
  const errors: Record<string, string> = {};
  const filter: Record<string, unknown> = {};
  const consumedKeys = new Set<string>();

  for (const declared of filters) {
    const field = declared.field;
    if (declared.kind === "boolean") {
      if (!(field in safeQuery)) {
        continue;
      }
      consumedKeys.add(field);
      const parsed = parseBooleanFilter(field, safeQuery[field]);
      if (!parsed.ok) {
        errors[field] = parsed.error;
        continue;
      }
      filter[field] = parsed.value;
      continue;
    }

    if (declared.kind === "text") {
      if (!(field in safeQuery)) {
        continue;
      }
      consumedKeys.add(field);
      const parsed = parseTextFilter(field, safeQuery[field]);
      if (!parsed.ok) {
        errors[field] = parsed.error;
        continue;
      }
      filter[field] = parsed.value;
      continue;
    }

    if (declared.kind === "choice") {
      if (!(field in safeQuery)) {
        continue;
      }
      consumedKeys.add(field);
      const parsed = parseChoiceFilter(field, safeQuery[field], declared.choices);
      if (!parsed.ok) {
        errors[field] = parsed.error;
        continue;
      }
      filter[field] = parsed.value;
      continue;
    }

    if (declared.kind === "ref") {
      if (!(field in safeQuery)) {
        continue;
      }
      consumedKeys.add(field);
      const parsed = parseRefFilter(field, safeQuery[field]);
      if (!parsed.ok) {
        errors[field] = parsed.error;
        continue;
      }
      filter[field] = parsed.value;
      continue;
    }

    if (declared.kind === "dateRange") {
      const gteKey = `${field}_gte`;
      const lteKey = `${field}_lte`;
      const hasGte = gteKey in safeQuery;
      const hasLte = lteKey in safeQuery;
      if (!hasGte && !hasLte) {
        continue;
      }
      const range: {$gte?: Date; $lte?: Date} = {};
      if (hasGte) {
        consumedKeys.add(gteKey);
        const parsed = parseIsoDate(gteKey, safeQuery[gteKey]);
        if (!parsed.ok) {
          errors[gteKey] = parsed.error;
        } else {
          range.$gte = parsed.value;
        }
      }
      if (hasLte) {
        consumedKeys.add(lteKey);
        const parsed = parseIsoDate(lteKey, safeQuery[lteKey]);
        if (!parsed.ok) {
          errors[lteKey] = parsed.error;
        } else {
          range.$lte = parsed.value;
        }
      }
      if (Object.keys(range).length > 0) {
        filter[field] = range;
      }
    }
  }

  for (const key of Object.keys(safeQuery)) {
    if (isOperatorKey(key)) {
      errors[key] = "Mongo operators are not allowed in admin list filters";
    }
  }

  return {consumedKeys, errors, filter};
};
