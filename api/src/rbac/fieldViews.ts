import type {FieldMask} from "./types";

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getNestedValue = (doc: Record<string, unknown>, path: string): unknown => {
  const parts = path.split(".");
  let current: unknown = doc;
  for (const part of parts) {
    if (!isPlainObject(current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
};

const setNestedValue = (doc: Record<string, unknown>, path: string, value: unknown): void => {
  const parts = path.split(".");
  let current: Record<string, unknown> = doc;
  for (let index = 0; index < parts.length - 1; index++) {
    const part = parts[index];
    const next = current[part];
    if (!isPlainObject(next)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
};

const pickPaths = (doc: Record<string, unknown>, paths: string[]): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const path of paths) {
    const value = getNestedValue(doc, path);
    if (value !== undefined) {
      setNestedValue(result, path, value);
    }
  }
  return result;
};

export const applyReadMask = (
  value: unknown,
  mask: FieldMask,
): unknown => {
  if (!isPlainObject(value) && !Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => applyReadMask(item, mask));
  }

  const doc = value as Record<string, unknown>;
  let result: Record<string, unknown>;
  if (mask.read === "*") {
    result = {...doc};
  } else {
    result = pickPaths(doc, mask.read);
  }

  for (const omitPath of mask.omit ?? []) {
    const parts = omitPath.split(".");
    if (parts.length === 1) {
      delete result[parts[0]];
    } else {
      const parent = getNestedValue(result, parts.slice(0, -1).join("."));
      if (isPlainObject(parent)) {
        delete parent[parts[parts.length - 1]];
      }
    }
  }

  return result;
};

export const getDisallowedWriteKeys = (
  body: Record<string, unknown>,
  mask: FieldMask,
): string[] => {
  if (mask.write === "*") {
    return [];
  }

  const allowed = new Set(mask.write);
  return Object.keys(body).filter((key) => !allowed.has(key));
};
