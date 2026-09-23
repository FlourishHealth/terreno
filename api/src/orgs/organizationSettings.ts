import mongoose from "mongoose";

import {ValidationError} from "../errors";
import type {OrganizationSettings} from "../types/organization";

const SETTINGS_VALIDATOR_MODEL = "__TerrenoOrganizationSettings";

let registeredOrganizationSettingsSchema: mongoose.Schema | undefined;

const dropSettingsValidatorModel = (): void => {
  const existing = mongoose.models[SETTINGS_VALIDATOR_MODEL];
  if (existing) {
    mongoose.deleteModel(SETTINGS_VALIDATOR_MODEL);
  }
};

/**
 * Build a nested Mongoose schema for `Organization.settings`.
 * Fields should be optional or have defaults so existing organizations still validate.
 */
export const createOrganizationSettingsSchema = (
  definition: mongoose.SchemaDefinition,
  options?: mongoose.SchemaOptions
): mongoose.Schema => {
  return new mongoose.Schema(definition, {
    _id: false,
    id: false,
    strict: "throw",
    ...options,
  });
};

/** Register the app settings schema. Call before creating or patching organizations. */
export const registerOrganizationSettings = (schema?: mongoose.Schema): void => {
  dropSettingsValidatorModel();
  registeredOrganizationSettingsSchema = schema;
};

export const getOrganizationSettingsSchema = (): mongoose.Schema | undefined => {
  return registeredOrganizationSettingsSchema;
};

const settingsValidationMessage = (error: unknown): string => {
  if (error instanceof mongoose.Error.ValidationError) {
    return Object.values(error.errors)
      .map((fieldError) => fieldError.message)
      .join("; ");
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Organization settings are invalid";
};

const getSettingsValidatorModel = (schema: mongoose.Schema): mongoose.Model<mongoose.Document> => {
  const existing = mongoose.models[SETTINGS_VALIDATOR_MODEL] as
    | mongoose.Model<mongoose.Document>
    | undefined;
  if (existing) {
    return existing;
  }
  return mongoose.model<mongoose.Document>(SETTINGS_VALIDATOR_MODEL, schema, undefined, {
    overwriteModels: true,
  });
};

/**
 * Validate and cast `Organization.settings` when a schema is registered.
 * With no schema, Mixed values pass through unchanged.
 */
export const applyOrganizationSettings = <
  TSettings extends OrganizationSettings = OrganizationSettings,
>(
  settings: unknown
): TSettings | undefined => {
  if (settings === undefined || settings === null) {
    return undefined;
  }
  const schema = registeredOrganizationSettingsSchema;
  if (!schema) {
    return settings as TSettings;
  }
  if (typeof settings !== "object" || Array.isArray(settings)) {
    throw new ValidationError({
      fields: {settings: "Organization settings must be an object"},
      title: "Organization settings must be an object",
    });
  }
  try {
    const unknownKeys = Object.keys(settings).filter((key) => {
      return schema.path(key) === undefined;
    });
    if (unknownKeys.length > 0) {
      throw new ValidationError({
        fields: {settings: `Unknown settings field: ${unknownKeys.join(", ")}`},
        title: "Organization settings are invalid",
      });
    }
    const ValidatorModel = getSettingsValidatorModel(schema);
    const document = new ValidatorModel(settings);
    const validationError = document.validateSync();
    if (validationError) {
      throw validationError;
    }
    return document.toObject({versionKey: false}) as unknown as TSettings;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError({
      cause: error instanceof Error ? error : undefined,
      detail: settingsValidationMessage(error),
      fields: {settings: settingsValidationMessage(error)},
      title: "Organization settings are invalid",
    });
  }
};

/** Read typed settings from an organization document or API payload. */
export const organizationSettingsOf = <
  TSettings extends OrganizationSettings = OrganizationSettings,
>(organization: {
  settings?: TSettings | null;
}): TSettings => {
  return (organization.settings ?? {}) as TSettings;
};
