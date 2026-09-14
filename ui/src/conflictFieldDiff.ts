/** Internal/sync metadata — omitted from user-facing conflict diffs. */
export const CONFLICT_METADATA_FIELDS = new Set([
  "__v",
  "_id",
  "_syncSeq",
  "created",
  "createdAt",
  "deletedAt",
  "pendingMutationId",
  "updated",
  "updatedAt",
]);

export const NO_CONFLICT_DIFF_FIELDS = "No differing fields found";

export const parseConflictPayload = (json: string): Record<string, unknown> => {
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to the empty shape.
  }
  return {};
};

export const getChangedConflictFields = ({
  local,
  server,
}: {
  local: Record<string, unknown>;
  server: Record<string, unknown>;
}): string[] => {
  const fields = new Set([...Object.keys(local), ...Object.keys(server)]);
  return [...fields]
    .filter((field) => !CONFLICT_METADATA_FIELDS.has(field))
    .filter((field) => JSON.stringify(local[field]) !== JSON.stringify(server[field]))
    .sort();
};

export const formatConflictFieldLabel = (field: string): string => {
  const spaced = field.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
};

export const formatConflictFieldValue = (value: unknown): string => {
  if (value === undefined) {
    return "Not set";
  }
  if (value === null) {
    return "None";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const json = JSON.stringify(value);
  return json.length > 120 ? `${json.slice(0, 120)}…` : json;
};

export const summarizeConflictSide = ({
  data,
  changedFields,
}: {
  data: Record<string, unknown>;
  changedFields: string[];
}): string => {
  if (typeof data.title === "string" && data.title.length > 0) {
    return data.title;
  }
  if (changedFields.length === 0) {
    return NO_CONFLICT_DIFF_FIELDS;
  }
  return `${changedFields.length} changed field${changedFields.length === 1 ? "" : "s"}`;
};
