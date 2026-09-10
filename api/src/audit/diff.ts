const DEFAULT_AUDIT_REDACT_SEGMENTS = [
  "hash",
  "password",
  "refreshToken",
  "salt",
  "secret",
  "token",
] as const;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
};

const DEFAULT_REDACT_LOWER = DEFAULT_AUDIT_REDACT_SEGMENTS.map((segment) => segment.toLowerCase());

const isRedactedSegment = (name: string, extraRedact: string[] = []): boolean => {
  const lower = name.toLowerCase();
  if (DEFAULT_REDACT_LOWER.includes(lower)) {
    return true;
  }
  return extraRedact.some((segment) => segment.toLowerCase() === lower);
};

export const toAuditPlain = (value: unknown): Record<string, unknown> | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const withJson = value as {toJSON?: () => unknown};
  const raw = typeof withJson.toJSON === "function" ? withJson.toJSON() : value;
  if (!isPlainObject(raw)) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(raw)) as Record<string, unknown>;
};

const redactRecord = (
  input: Record<string, unknown>,
  extraRedact: string[]
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(input)) {
    if (isRedactedSegment(key, extraRedact)) {
      continue;
    }
    if (isPlainObject(nested)) {
      const inner: Record<string, unknown> = {};
      for (const [innerKey, innerValue] of Object.entries(nested)) {
        if (!isRedactedSegment(innerKey, extraRedact)) {
          inner[innerKey] = innerValue;
        }
      }
      out[key] = inner;
      continue;
    }
    out[key] = nested;
  }
  return out;
};

const valuesEqual = (left: unknown, right: unknown): boolean => {
  return JSON.stringify(left) === JSON.stringify(right);
};

const diffShallow = (
  before: Record<string, unknown>,
  after: Record<string, unknown>
): {after: Record<string, unknown>; before: Record<string, unknown>} => {
  const beforeOut: Record<string, unknown> = {};
  const afterOut: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const previous = before[key];
    const next = after[key];
    if (valuesEqual(previous, next)) {
      continue;
    }
    if (previous !== undefined) {
      beforeOut[key] = previous;
    }
    if (next !== undefined) {
      afterOut[key] = next;
    }
  }
  return {after: afterOut, before: beforeOut};
};

export const changedFieldDiff = ({
  after,
  before,
  extraRedact = [],
}: {
  after?: Record<string, unknown>;
  before?: Record<string, unknown>;
  extraRedact?: string[];
}): {after?: Record<string, unknown>; before?: Record<string, unknown>} => {
  const redactedBefore = before ? redactRecord(before, extraRedact) : undefined;
  const redactedAfter = after ? redactRecord(after, extraRedact) : undefined;
  if (!redactedBefore) {
    return redactedAfter ? {after: redactedAfter} : {};
  }
  if (!redactedAfter) {
    return {before: redactedBefore};
  }

  const beforeOut: Record<string, unknown> = {};
  const afterOut: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(redactedBefore), ...Object.keys(redactedAfter)]);
  for (const key of keys) {
    const previous = redactedBefore[key];
    const next = redactedAfter[key];
    if (isPlainObject(previous) && isPlainObject(next)) {
      const nested = diffShallow(previous, next);
      if (Object.keys(nested.before).length > 0) {
        beforeOut[key] = nested.before;
      }
      if (Object.keys(nested.after).length > 0) {
        afterOut[key] = nested.after;
      }
      continue;
    }
    if (valuesEqual(previous, next)) {
      continue;
    }
    if (previous !== undefined) {
      beforeOut[key] = previous;
    }
    if (next !== undefined) {
      afterOut[key] = next;
    }
  }

  return {
    ...(Object.keys(afterOut).length > 0 ? {after: afterOut} : {}),
    ...(Object.keys(beforeOut).length > 0 ? {before: beforeOut} : {}),
  };
};

export const recordLabelFromDoc = (doc?: Record<string, unknown>): string | undefined => {
  if (!doc) {
    return undefined;
  }
  for (const field of ["title", "name", "email"]) {
    const value = doc[field];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
};
