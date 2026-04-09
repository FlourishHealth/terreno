import type {Model} from "mongoose";
import {type ZodType, z} from "zod";

import type {MCPConfig, MCPMethod} from "./types";

const SYSTEM_FIELDS = new Set(["_id", "id", "__v", "created", "updated", "deleted"]);

const mongooseTypeToZod = (schemaPath: any): ZodType => {
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

const getModelFields = (
  model: Model<any>,
  excludeFields: string[]
): {path: string; schemaPath: any; required: boolean; description?: string}[] => {
  const fields: {path: string; schemaPath: any; required: boolean; description?: string}[] = [];
  const schemaPaths = model.schema.paths;

  for (const [path, schemaPath] of Object.entries(schemaPaths)) {
    if (SYSTEM_FIELDS.has(path)) {
      continue;
    }
    if (isFieldExcluded(path, excludeFields)) {
      continue;
    }

    const isRequired = Boolean((schemaPath as any).isRequired);
    const description = (schemaPath as any).options?.description;
    fields.push({description, path, required: isRequired, schemaPath});
  }

  return fields;
};

export const generateInputSchema = (
  model: Model<any>,
  method: MCPMethod,
  config: MCPConfig,
  queryFields?: string[]
): ZodType => {
  const excludeFields = config.excludeFields ?? [];

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

    case "read":
      return z.object({
        id: z.string().describe("Document ID to read"),
        populate: z.string().optional().describe("Comma-separated list of fields to populate"),
      });

    case "list": {
      const shape: Record<string, ZodType> = {
        limit: z
          .number()
          .optional()
          .describe(`Max items to return (default: ${config.maxLimit ?? 50})`),
        page: z.number().optional().describe("Page number (1-based)"),
        populate: z.string().optional().describe("Comma-separated list of fields to populate"),
        sort: z.string().optional().describe("Sort field (prefix with - for descending)"),
      };
      // Add queryFields as optional filter parameters
      if (queryFields?.length) {
        for (const field of queryFields) {
          if (!isFieldExcluded(field, excludeFields)) {
            shape[field] = z.any().optional().describe(`Filter by ${field}`);
          }
        }
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

const describeField = (field: {path: string; schemaPath: any; required: boolean}): string => {
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
  model: Model<any>,
  method: MCPMethod,
  config: MCPConfig,
  queryFields?: string[]
): string => {
  if (config.description) {
    const methodPrefix = `${method.charAt(0).toUpperCase()}${method.slice(1)}`;
    return `${methodPrefix}: ${config.description}`;
  }

  const modelName = model.modelName;
  const excludeFields = config.excludeFields ?? [];
  const maxLimit = config.maxLimit ?? 50;

  switch (method) {
    case "list": {
      const parts = [`List ${modelName} items.`];
      const availableQueryFields = queryFields?.filter((f) => !isFieldExcluded(f, excludeFields));
      if (availableQueryFields?.length) {
        parts.push(`Filterable by: ${availableQueryFields.join(", ")}.`);
      }
      parts.push(`Sortable. Paginated (max ${maxLimit}).`);
      return parts.join(" ");
    }
    case "read": {
      const fields = getModelFields(model, excludeFields);
      const refFields = fields.filter((f) => f.schemaPath.options?.ref);
      const parts = [`Read a single ${modelName} by ID.`];
      if (refFields.length) {
        parts.push(
          `Populate-able refs: ${refFields.map((f) => `${f.path} (${f.schemaPath.options.ref})`).join(", ")}.`
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
