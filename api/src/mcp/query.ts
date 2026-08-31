import type {ModelRouterOptions} from "../api";
import {isFieldExcluded} from "./schemaGenerator";
import type {MCPConfig, MCPToolArgs} from "./types";

/** Args consumed by pagination/population, never treated as filters. */
export const RESERVED_LIST_ARGS = new Set(["limit", "page", "populate", "sort"]);

/**
 * Top-level logical operators an MCP client may send. Mirrors the REST list endpoint,
 * which allows `$and` / `$or` and validates every nested key against `queryFields`.
 */
export const ALLOWED_LOGICAL_OPERATORS = new Set(["$and", "$or"]);

/**
 * Comparison operators allowed inside a field's value, e.g. `{completed: {$ne: true}}`.
 * Deliberately excludes evaluation operators that can run arbitrary code or ignore
 * indexes ($where, $expr, $function, $accumulator, $jsonSchema, $text).
 */
export const ALLOWED_FIELD_OPERATORS = new Set([
  "$all",
  "$eq",
  "$exists",
  "$gt",
  "$gte",
  "$in",
  "$lt",
  "$lte",
  "$ne",
  "$nin",
  "$options",
  "$regex",
  "$size",
]);

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

/**
 * Recursively reject `$`-prefixed keys that are not in the field-operator allowlist.
 * Non-operator keys are left alone so exact matches on embedded documents still work.
 *
 * @returns The offending operator name, or undefined when the value is safe.
 */
const findDisallowedOperator = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findDisallowedOperator(item);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  if (!isPlainObject(value)) {
    return undefined;
  }

  for (const [key, nested] of Object.entries(value)) {
    if (key.startsWith("$") && !ALLOWED_FIELD_OPERATORS.has(key)) {
      return key;
    }
    const found = findDisallowedOperator(nested);
    if (found) {
      return found;
    }
  }

  return undefined;
};

/**
 * Validate one branch of a `$and` / `$or` clause. Every key must either be another
 * logical operator or a field listed in `queryFields`, matching REST's behavior.
 */
const validateLogicalBranch = (
  branch: unknown,
  allowedQueryFields: Set<string>
): string | undefined => {
  if (!isPlainObject(branch)) {
    return "Logical operators ($and/$or) take an array of filter objects";
  }

  for (const [key, value] of Object.entries(branch)) {
    if (ALLOWED_LOGICAL_OPERATORS.has(key)) {
      const error = validateLogicalClause(key, value, allowedQueryFields);
      if (error) {
        return error;
      }
      continue;
    }
    if (!allowedQueryFields.has(key)) {
      return `${key} is not allowed as a filter field`;
    }
    const disallowed = findDisallowedOperator(value);
    if (disallowed) {
      return `${disallowed} is not an allowed query operator`;
    }
  }

  return undefined;
};

const validateLogicalClause = (
  operator: string,
  value: unknown,
  allowedQueryFields: Set<string>
): string | undefined => {
  if (!Array.isArray(value) || value.length === 0) {
    return `${operator} takes a non-empty array of filter objects`;
  }
  for (const branch of value) {
    const error = validateLogicalBranch(branch, allowedQueryFields);
    if (error) {
      return error;
    }
  }
  return undefined;
};

export interface BuildListQueryResult {
  query?: Record<string, unknown>;
  error?: string;
}

/**
 * Build a Mongo query from MCP list tool args.
 *
 * Only fields in `options.queryFields` may be filtered on, and values may use the
 * comparison operators in {@link ALLOWED_FIELD_OPERATORS} plus top-level `$and` / `$or`.
 * Anything else is rejected rather than silently dropped so the calling LLM can correct
 * itself instead of receiving results for a query it did not ask for.
 */
export const buildListQuery = <T>({
  args,
  config,
  options,
}: {
  args: MCPToolArgs;
  config: MCPConfig;
  options: ModelRouterOptions<T>;
}): BuildListQueryResult => {
  const query: Record<string, unknown> = {...(options.defaultQueryParams ?? {})};
  const excludeFields = config.excludeFields ?? [];
  const allowedQueryFields = new Set(
    (options.queryFields ?? []).filter((field) => !isFieldExcluded(field, excludeFields))
  );

  for (const [key, value] of Object.entries(args)) {
    if (RESERVED_LIST_ARGS.has(key) || value === undefined) {
      continue;
    }

    if (ALLOWED_LOGICAL_OPERATORS.has(key)) {
      const error = validateLogicalClause(key, value, allowedQueryFields);
      if (error) {
        return {error};
      }
      query[key] = value;
      continue;
    }

    if (!allowedQueryFields.has(key)) {
      continue;
    }

    const disallowed = findDisallowedOperator(value);
    if (disallowed) {
      return {error: `${disallowed} is not an allowed query operator`};
    }

    query[key] = value;
  }

  return {query};
};
