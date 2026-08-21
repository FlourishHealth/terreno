import mongoose from "mongoose";

/** List-query param for the admin table search box. */
export const ADMIN_LIST_SEARCH_PARAM = "q";

export const escapeRegexLiteral = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Case-insensitive partial match across string `searchFields`, plus ObjectId equality
 * when `q` is a valid id.
 */
export const buildAdminPartialSearchFilter = ({
  extraObjectIdFields,
  model,
  q,
  searchFields,
}: {
  extraObjectIdFields?: string[];
  model: {schema: mongoose.Schema};
  q: string;
  searchFields: string[];
}): Record<string, unknown> | undefined => {
  const trimmed = q.trim();
  if (!trimmed) {
    return undefined;
  }

  const regex = new RegExp(escapeRegexLiteral(trimmed), "i");
  const orConditions: Record<string, unknown>[] = [];
  const seenFields = new Set<string>();

  for (const field of searchFields) {
    if (seenFields.has(field)) {
      continue;
    }
    seenFields.add(field);
    const schemaPath = model.schema.path(field);
    if (schemaPath && schemaPath.instance !== "String") {
      continue;
    }
    orConditions.push({[field]: {$regex: regex}});
  }

  if (mongoose.isValidObjectId(trimmed)) {
    const objectIdFields = extraObjectIdFields
      ? [...extraObjectIdFields]
      : Object.keys(model.schema.paths).filter(
          (key) => model.schema.path(key)?.instance === "ObjectID"
        );
    for (const field of objectIdFields) {
      orConditions.push({[field]: new mongoose.Types.ObjectId(trimmed)});
    }
  }

  if (orConditions.length === 0) {
    return undefined;
  }
  return {$or: orConditions};
};

export const andMongoFilters = (
  base: Record<string, unknown>,
  extra: Record<string, unknown> | undefined
): Record<string, unknown> => {
  if (!extra) {
    return base;
  }
  if (Object.keys(base).length === 0) {
    return extra;
  }
  return {$and: [base, extra]};
};
