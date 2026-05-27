// biome-ignore-all lint/suspicious/noExplicitAny: MongoDB query matcher evaluates dynamic filter shapes
/**
 * Simple in-memory MongoDB query matcher.
 * Evaluates a MongoDB-style query object against a document without hitting the database.
 *
 * Supports: equality, $eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $exists, $and, $or, $not.
 */

// biome-ignore lint/suspicious/noExplicitAny: traversing arbitrary nested document fields by user-supplied dotted path
const getNestedValue = (doc: any, path: string): any => {
  const parts = path.split(".");
  let current = doc;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }
  return current;
};

// biome-ignore lint/suspicious/noExplicitAny: value may be any document field type (string, number, ObjectId, etc.)
const normalize = (value: any): any => {
  if (value === null || value === undefined) {
    return value;
  }
  // Handle ObjectId-like objects with toString
  if (
    typeof value === "object" &&
    typeof value.toString === "function" &&
    value.constructor?.name !== "Object" &&
    !Array.isArray(value)
  ) {
    return value.toString();
  }
  return value;
};

// biome-ignore lint/suspicious/noExplicitAny: rawValue is an arbitrary document field, condition is an arbitrary user query operand
const matchesCondition = (rawValue: any, condition: any): boolean => {
  const value = normalize(rawValue);

  // Direct equality (non-object condition)
  if (condition === null || condition === undefined || typeof condition !== "object") {
    const normalizedCondition = normalize(condition);
    return value === normalizedCondition || String(value) === String(normalizedCondition);
  }

  // Array equality
  if (Array.isArray(condition)) {
    return JSON.stringify(value) === JSON.stringify(condition);
  }

  // Operator object
  for (const [op, operand] of Object.entries(condition)) {
    const normOp = normalize(operand);

    switch (op) {
      case "$eq":
        if (value !== normOp && String(value) !== String(normOp)) {
          return false;
        }
        break;
      case "$ne":
        if (value === normOp || String(value) === String(normOp)) {
          return false;
        }
        break;
      case "$gt":
        if (!(value > normOp)) {
          return false;
        }
        break;
      case "$gte":
        if (!(value >= normOp)) {
          return false;
        }
        break;
      case "$lt":
        if (!(value < normOp)) {
          return false;
        }
        break;
      case "$lte":
        if (!(value <= normOp)) {
          return false;
        }
        break;
      case "$in": {
        if (!Array.isArray(operand)) {
          return false;
        }
        const inValues = operand.map(normalize);
        // biome-ignore lint/suspicious/noExplicitAny: normalized value of arbitrary document field
        if (!inValues.some((v: any) => v === value || String(v) === String(value))) {
          return false;
        }
        break;
      }
      case "$nin": {
        if (!Array.isArray(operand)) {
          return false;
        }
        const ninValues = operand.map(normalize);
        // biome-ignore lint/suspicious/noExplicitAny: normalized value of arbitrary document field
        if (ninValues.some((v: any) => v === value || String(v) === String(value))) {
          return false;
        }
        break;
      }
      case "$exists":
        if (operand && rawValue === undefined) {
          return false;
        }
        if (!operand && rawValue !== undefined) {
          return false;
        }
        break;
      case "$not":
        if (matchesCondition(rawValue, operand)) {
          return false;
        }
        break;
      default:
        // Unknown operator — fail closed to avoid leaking data
        return false;
    }
  }

  return true;
};

/**
 * Check if a document matches a MongoDB-style query in memory.
 *
 * @param doc - The document to test (plain object or Mongoose document)
 * @param query - MongoDB-style query object
 * @returns true if the document matches all query conditions
 */
// biome-ignore lint/suspicious/noExplicitAny: doc is arbitrary; query values are arbitrary user-supplied JSON
export const matchesQuery = (doc: any, query: Record<string, any>): boolean => {
  for (const [key, condition] of Object.entries(query)) {
    if (key === "$and") {
      if (!Array.isArray(condition)) {
        return false;
      }
      for (const subQuery of condition) {
        if (!matchesQuery(doc, subQuery)) {
          return false;
        }
      }
      continue;
    }

    if (key === "$or") {
      if (!Array.isArray(condition)) {
        return false;
      }
      let matched = false;
      for (const subQuery of condition) {
        if (matchesQuery(doc, subQuery)) {
          matched = true;
          break;
        }
      }
      if (!matched) {
        return false;
      }
      continue;
    }

    const value = getNestedValue(doc, key);
    if (!matchesCondition(value, condition)) {
      return false;
    }
  }

  return true;
};
