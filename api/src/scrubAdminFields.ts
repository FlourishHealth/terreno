import type {Schema, SchemaType} from "mongoose";

import type {AdminConfig, AdminModelAdminMap} from "./adminTypes";

const toPlainObject = (value: unknown): Record<string, unknown> => {
  if (
    value &&
    typeof value === "object" &&
    "toObject" in value &&
    typeof (value as {toObject?: unknown}).toObject === "function"
  ) {
    return (value as {toObject: () => Record<string, unknown>}).toObject();
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const adminFieldsToStrip = (admin: AdminConfig): Set<string> => {
  return new Set([...(admin.excludeFields ?? []), ...(admin.hiddenFields ?? [])]);
};

const getRefModelName = (schemaPath: SchemaType | undefined): string | undefined => {
  if (!schemaPath) {
    return undefined;
  }
  const options = schemaPath.options as {ref?: string} | undefined;
  if (typeof options?.ref === "string" && options.ref.length > 0) {
    return options.ref;
  }
  return undefined;
};

const isPopulatedDocument = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const plain = value as Record<string, unknown>;
  return plain._id != null && Object.keys(plain).length > 1;
};

const scrubPlainObject = (
  plain: Record<string, unknown>,
  admin: AdminConfig,
  schema: Schema | undefined,
  allModelAdmins: AdminModelAdminMap | undefined
): Record<string, unknown> => {
  const strip = adminFieldsToStrip(admin);
  const next: Record<string, unknown> = {};

  for (const [key, fieldValue] of Object.entries(plain)) {
    if (strip.has(key)) {
      continue;
    }

    if (fieldValue == null) {
      next[key] = fieldValue;
      continue;
    }

    if (Array.isArray(fieldValue)) {
      next[key] = fieldValue.map((item) =>
        scrubAdminFields(item, {admin, allModelAdmins, fieldName: key, schema})
      );
      continue;
    }

    if (isPopulatedDocument(fieldValue) && schema) {
      const refModelName = getRefModelName(schema.path(key));
      const refAdmin = refModelName ? allModelAdmins?.[refModelName] : undefined;
      if (refAdmin) {
        next[key] = scrubAdminFields(fieldValue, {
          admin: refAdmin,
          allModelAdmins,
          schema: undefined,
        });
        continue;
      }
    }

    next[key] = fieldValue;
  }

  return next;
};

export interface ScrubAdminFieldsParams {
  admin: AdminConfig;
  allModelAdmins?: AdminModelAdminMap;
  fieldName?: string;
  schema?: Schema;
}

/**
 * Removes `excludeFields` and `hiddenFields` from a document (or nested value).
 * Populated refs are scrubbed using the referenced model's admin config when present
 * in `allModelAdmins` (keyed by Mongoose model name).
 */
export const scrubAdminFields = (value: unknown, params: ScrubAdminFieldsParams): unknown => {
  if (value == null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubAdminFields(item, params));
  }

  if (typeof value !== "object") {
    return value;
  }

  const plain = toPlainObject(value);
  return scrubPlainObject(plain, params.admin, params.schema, params.allModelAdmins);
};

/** Keys stripped from POST/PATCH bodies when `admin` is set on modelRouter. */
export const adminBodyFieldsToStrip = (admin: AdminConfig): Set<string> => {
  return new Set([
    ...(admin.readonlyFields ?? []),
    ...(admin.excludeFields ?? []),
    ...(admin.hiddenFields ?? []),
  ]);
};

export const stripAdminBodyFields = <T extends Record<string, unknown>>(
  body: T | T[] | null | undefined,
  admin: AdminConfig
): T | T[] | null | undefined => {
  if (body == null) {
    return body;
  }

  const strip = adminBodyFieldsToStrip(admin);

  const stripObject = (obj: T): T => {
    const next = {...obj};
    for (const key of strip) {
      delete next[key];
    }
    return next;
  };

  if (Array.isArray(body)) {
    return body.map((item) => {
      if (!item || typeof item !== "object") {
        return item;
      }
      return stripObject(item);
    });
  }

  if (typeof body !== "object") {
    return body;
  }

  return stripObject(body);
};
