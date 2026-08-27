import type {Model} from "mongoose";
import {type ZodType, z} from "zod";

import type {PopulatePath} from "../populate";
import {
  describeModel,
  type FieldDescription,
  fieldDescriptionToZodType,
  SYSTEM_FIELD_PATHS,
} from "../schemaMetadata";
import type {MCPConfig, MCPMethod} from "./types";

const OPERATOR_HINT = `{"$in": [...]} or {"$gte": ...}`;
const DOCUMENTED_FIELD_OPERATORS = "$eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $exists, $regex";

interface ModelField {
  description?: string;
  field: FieldDescription;
  path: string;
  required: boolean;
}

export const isFieldExcluded = (fieldPath: string, excludeFields: string[]): boolean => {
  return excludeFields.some((excluded) => {
    if (fieldPath === excluded) {
      return true;
    }
    if (fieldPath.startsWith(`${excluded}.`)) {
      return true;
    }
    return false;
  });
};

export const restWriteExcludeFields = (method: MCPMethod, validation: unknown): string[] => {
  if (typeof validation !== "object" || validation === null) {
    return [];
  }
  const options = validation as {
    excludeFromCreate?: string[];
    excludeFromUpdate?: string[];
  };
  if (method === "create") {
    return options.excludeFromCreate ?? [];
  }
  if (method === "update") {
    return options.excludeFromUpdate ?? [];
  }
  return [];
};

export const writeExcludeFields = (config: MCPConfig, restExcludeFields: string[]): string[] => {
  return [...(config.excludeFields ?? []), ...restExcludeFields];
};

const getModelFields = <T>(model: Model<T>, excludeFields: string[]): ModelField[] => {
  const description = describeModel(model);
  const fields: ModelField[] = [];

  for (const [path, field] of Object.entries(description.fields)) {
    if (SYSTEM_FIELD_PATHS.has(path) || field.system) {
      continue;
    }
    if (isFieldExcluded(path, excludeFields)) {
      continue;
    }

    fields.push({
      description: field.description,
      field,
      path,
      required: field.required,
    });
  }

  return fields;
};

export const generateInputSchema = <T>(
  model: Model<T>,
  method: MCPMethod,
  config: MCPConfig,
  queryFields?: string[],
  populatePaths?: PopulatePath[],
  restExcludeFields: string[] = []
): ZodType => {
  const excludeFields = writeExcludeFields(config, restExcludeFields);
  const populatable = (populatePaths ?? []).map((populatePath) => populatePath.path);
  const populateParam = populatable.length
    ? z
        .string()
        .optional()
        .describe(`Comma-separated subset of the populate-able paths: ${populatable.join(", ")}`)
    : undefined;

  switch (method) {
    case "create": {
      const fields = getModelFields(model, excludeFields);
      const shape: Record<string, ZodType> = {};
      for (const {field, path, required} of fields) {
        const zodType = fieldDescriptionToZodType(field, z);
        shape[path] = required ? zodType : zodType.optional();
      }
      return z.object(shape);
    }

    case "update": {
      const fields = getModelFields(model, excludeFields);
      const shape: Record<string, ZodType> = {
        id: z.string().describe("Document ID to update"),
      };
      for (const {field, path} of fields) {
        shape[path] = fieldDescriptionToZodType(field, z).optional();
      }
      return z.object(shape);
    }

    case "read": {
      const shape: Record<string, ZodType> = {
        id: z.string().describe("Document ID to read"),
      };
      if (populateParam) {
        shape.populate = populateParam;
      }
      return z.object(shape);
    }

    case "list": {
      const shape: Record<string, ZodType> = {
        limit: z
          .number()
          .optional()
          .describe(`Max items to return (default: ${config.maxLimit ?? 50})`),
        page: z.number().optional().describe("Page number (1-based)"),
        sort: z.string().optional().describe("Sort field (prefix with - for descending)"),
      };
      if (populateParam) {
        shape.populate = populateParam;
      }
      const filterableFields = (queryFields ?? []).filter(
        (field) => !isFieldExcluded(field, excludeFields)
      );
      for (const field of filterableFields) {
        shape[field] = z
          .any()
          .optional()
          .describe(
            `Filter by ${field}: an exact value or an operator object, e.g. ${OPERATOR_HINT}`
          );
      }
      if (filterableFields.length) {
        const logicalDescription = `Combine filters on ${filterableFields.join(", ")}, e.g. [{"${filterableFields[0]}": ...}]`;
        shape.$and = z
          .array(z.record(z.string(), z.any()))
          .optional()
          .describe(`Match all of these filters. ${logicalDescription}`);
        shape.$or = z
          .array(z.record(z.string(), z.any()))
          .optional()
          .describe(`Match any of these filters. ${logicalDescription}`);
      }
      return z.object(shape);
    }

    case "delete":
      return z.object({
        id: z.string().describe("Document ID to delete"),
      });

    default:
      return z.object({});
  }
};

const describeFieldKind = (field: FieldDescription): string => {
  if (field.isArray) {
    if (field.item?.kind) {
      const itemLabel =
        field.item.kind === "objectId"
          ? field.item.ref
            ? `ref:${field.item.ref}`
            : "ObjectId"
          : field.item.kind.charAt(0).toUpperCase() + field.item.kind.slice(1);
      return `(${itemLabel}[])`;
    }
    return "(Array)";
  }
  if (field.kind === "objectId") {
    return field.ref ? `(ref: ${field.ref})` : "(ObjectId)";
  }
  if (field.kind === "string" && field.enum?.length) {
    return `(enum: ${field.enum.join("|")})`;
  }
  const label = field.kind.charAt(0).toUpperCase() + field.kind.slice(1);
  return `(${label})`;
};

const describeField = ({field, path, required}: ModelField): string => {
  const parts = [path, describeFieldKind(field)];
  if (required) {
    parts.push("required");
  }
  return parts.join(" ");
};

export const generateToolDescription = <T>(
  model: Model<T>,
  method: MCPMethod,
  config: MCPConfig,
  queryFields?: string[],
  populatePaths?: PopulatePath[],
  restExcludeFields: string[] = []
): string => {
  if (config.description) {
    const methodPrefix = `${method.charAt(0).toUpperCase()}${method.slice(1)}`;
    return `${methodPrefix}: ${config.description}`;
  }

  const modelName = model.modelName;
  const excludeFields = writeExcludeFields(config, restExcludeFields);
  const maxLimit = config.maxLimit ?? 50;

  switch (method) {
    case "list": {
      const parts = [`List ${modelName} items.`];
      const availableQueryFields = queryFields?.filter((f) => !isFieldExcluded(f, excludeFields));
      if (availableQueryFields?.length) {
        parts.push(`Filterable by: ${availableQueryFields.join(", ")}.`);
        parts.push(
          `Filters accept an exact value or an operator object (${DOCUMENTED_FIELD_OPERATORS}), and can be combined with $and/$or.`
        );
      }
      parts.push(`Sortable. Paginated (max ${maxLimit}).`);
      return parts.join(" ");
    }
    case "read": {
      const parts = [`Read a single ${modelName} by ID.`];
      const fields = getModelFields(model, excludeFields);
      const refFields = (populatePaths ?? [])
        .map((populatePath) => fields.find((field) => field.path === populatePath.path))
        .filter((field): field is ModelField => Boolean(field?.field.ref));
      if (refFields.length) {
        parts.push(
          `Populate-able refs: ${refFields.map((f) => `${f.path} (${f.field.ref})`).join(", ")}.`
        );
      }
      return parts.join(" ");
    }
    case "create": {
      const fields = getModelFields(model, excludeFields);
      const parts = [`Create a new ${modelName}.`];
      const fieldDescs = fields.map(describeField);
      if (fieldDescs.length) {
        parts.push(`Fields: ${fieldDescs.join(", ")}.`);
      }
      return parts.join(" ");
    }
    case "update": {
      const fields = getModelFields(model, excludeFields);
      const parts = [`Update an existing ${modelName} by ID. Send only the fields to change.`];
      const fieldNames = fields.map((f) => f.path);
      if (fieldNames.length) {
        parts.push(`Updatable fields: ${fieldNames.join(", ")}.`);
      }
      return parts.join(" ");
    }
    case "delete":
      return `Delete a ${modelName} by ID.`;
    default:
      return `${method} on ${modelName}`;
  }
};
