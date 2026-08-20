import type {Model} from "mongoose";
import {type ZodType, z} from "zod";

import type {PopulatePath} from "../populate";
import type {MCPConfig, MCPMethod} from "./types";

const SYSTEM_FIELDS = new Set(["_id", "id", "__v", "created", "updated", "deleted"]);

/** Shown to the calling LLM so it knows filters accept Mongo comparison operators. */
const OPERATOR_HINT = `{"$in": [...]} or {"$gte": ...}`;

/** Operators an LLM may use in a list filter, kept in sync with ALLOWED_FIELD_OPERATORS. */
const DOCUMENTED_FIELD_OPERATORS = "$eq, $ne, $gt, $gte, $lt, $lte, $in, $nin, $exists, $regex";

/** The subset of Mongoose SchemaType internals used to derive MCP tool schemas. */
interface MongooseSchemaPath {
  caster?: {instance?: string; options?: {description?: string; ref?: string}};
  enumValues?: string[];
  instance?: string;
  isRequired?: boolean;
  options?: {description?: string; ref?: string};
  schema?: unknown;
}

interface ModelField {
  path: string;
  schemaPath: MongooseSchemaPath;
  required: boolean;
  description?: string;
}

const mongooseTypeToZod = (schemaPath: MongooseSchemaPath): ZodType => {
  const instance = schemaPath.instance;

  switch (instance) {
    case "String":
      if (schemaPath.enumValues?.length) {
        const values = schemaPath.enumValues as string[];
        return z.enum(values as [string, ...string[]]);
      }
      return z.string();
    case "Number":
      return z.number();
    case "Boolean":
      return z.boolean();
    case "Date":
      return z.string().describe("ISO 8601 date string");
    case "ObjectId":
    case "ObjectID":
      return z
        .string()
        .describe(
          schemaPath.options?.ref ? `ObjectId reference to ${schemaPath.options.ref}` : "ObjectId"
        );
    case "Array": {
      if (schemaPath.schema) {
        // Array of subdocuments
        return z.array(z.record(z.string(), z.any())).describe("Array of subdocuments");
      }
      // Array of primitives
      const caster = schemaPath.caster;
      if (caster) {
        const innerType = mongooseTypeToZod({
          instance: caster.instance,
          options: caster.options,
        });
        return z.array(innerType);
      }
      return z.array(z.any());
    }
    case "Mixed":
    case "Map":
      return z.record(z.string(), z.any());
    case "Embedded":
      return z.record(z.string(), z.any()).describe("Embedded document");
    default:
      return z.any();
  }
};

const isFieldExcluded = (fieldPath: string, excludeFields: string[]): boolean => {
  return excludeFields.some((excluded) => {
    if (fieldPath === excluded) {
      return true;
    }
    // Support dot-notation parent matching: excluding "metadata" excludes "metadata.secretKey"
    if (fieldPath.startsWith(`${excluded}.`)) {
      return true;
    }
    return false;
  });
};

/**
 * REST write denylist from `validation.excludeFromCreate` / `excludeFromUpdate`.
 * MCP create/update must apply the same keys REST strips in `validateModelRequestBody`.
 */
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

/** MCP `excludeFields` plus REST write denylist — used for tool schemas and persist. */
export const writeExcludeFields = (config: MCPConfig, restExcludeFields: string[]): string[] => {
  return [...(config.excludeFields ?? []), ...restExcludeFields];
};

const getModelFields = (
  // noExplicitAny: Mongoose's invariant generics require any to accept arbitrary consumer models
  // biome-ignore lint/suspicious/noExplicitAny: Mongoose's invariant generics require any to accept arbitrary consumer models
  model: Model<any>,
  excludeFields: string[]
): ModelField[] => {
  const fields: ModelField[] = [];
  const schemaPaths = model.schema.paths;

  for (const [path, rawSchemaPath] of Object.entries(schemaPaths)) {
    if (SYSTEM_FIELDS.has(path)) {
      continue;
    }
    if (isFieldExcluded(path, excludeFields)) {
      continue;
    }

    const schemaPath = rawSchemaPath as unknown as MongooseSchemaPath;
    fields.push({
      description: schemaPath.options?.description,
      path,
      required: Boolean(schemaPath.isRequired),
      schemaPath,
    });
  }

  return fields;
};

export const generateInputSchema = (
  // noExplicitAny: Mongoose's invariant generics require any to accept arbitrary consumer models
  // biome-ignore lint/suspicious/noExplicitAny: Mongoose's invariant generics require any to accept arbitrary consumer models
  model: Model<any>,
  method: MCPMethod,
  config: MCPConfig,
  queryFields?: string[],
  populatePaths?: PopulatePath[],
  restExcludeFields: string[] = []
): ZodType => {
  const excludeFields = writeExcludeFields(config, restExcludeFields);
  const populatable = (populatePaths ?? []).map((populatePath) => populatePath.path);
  // Only the model router's declared paths can be populated, so omit the parameter
  // entirely when there are none rather than inviting a request that must be refused.
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
      for (const field of fields) {
        let zodType = mongooseTypeToZod(field.schemaPath);
        if (field.description) {
          zodType = zodType.describe(field.description);
        }
        shape[field.path] = field.required ? zodType : zodType.optional();
      }
      return z.object(shape);
    }

    case "update": {
      const fields = getModelFields(model, excludeFields);
      const shape: Record<string, ZodType> = {
        id: z.string().describe("Document ID to update"),
      };
      for (const field of fields) {
        let zodType = mongooseTypeToZod(field.schemaPath);
        if (field.description) {
          zodType = zodType.describe(field.description);
        }
        shape[field.path] = zodType.optional();
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
      // Add queryFields as optional filter parameters
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

const describeField = (field: ModelField): string => {
  const parts = [field.path];
  const instance = field.schemaPath.instance;

  // Type info
  if (instance === "ObjectId" || instance === "ObjectID") {
    const ref = field.schemaPath.options?.ref;
    parts.push(ref ? `(ref: ${ref})` : "(ObjectId)");
  } else if (instance === "Array") {
    if (field.schemaPath.caster?.instance) {
      parts.push(`(${field.schemaPath.caster.instance}[])`);
    } else {
      parts.push("(Array)");
    }
  } else if (instance === "String" && field.schemaPath.enumValues?.length) {
    parts.push(`(enum: ${field.schemaPath.enumValues.join("|")})`);
  } else {
    parts.push(`(${instance})`);
  }

  if (field.required) {
    parts.push("required");
  }

  return parts.join(" ");
};

export const generateToolDescription = (
  // noExplicitAny: Mongoose's invariant generics require any to accept arbitrary consumer models
  // biome-ignore lint/suspicious/noExplicitAny: Mongoose's invariant generics require any to accept arbitrary consumer models
  model: Model<any>,
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
      // Only the model router's declared paths can be populated, so advertising every ref
      // field would point the model at requests that are refused.
      const fields = getModelFields(model, excludeFields);
      const refFields = (populatePaths ?? [])
        .map((populatePath) => fields.find((field) => field.path === populatePath.path))
        .filter((field): field is ModelField => Boolean(field?.schemaPath.options?.ref));
      if (refFields.length) {
        parts.push(
          `Populate-able refs: ${refFields.map((f) => `${f.path} (${f.schemaPath.options?.ref})`).join(", ")}.`
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
