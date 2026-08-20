import type {OpenApiSchema} from "./types";

const tsTypeFromSchema = (schema: OpenApiSchema, indent: string): string => {
  if (schema.enum && schema.enum.length > 0) {
    return schema.enum.map((value) => JSON.stringify(value)).join(" | ");
  }
  if (schema.type === "array") {
    const itemType = schema.items ? tsTypeFromSchema(schema.items, indent) : "unknown";
    return `${itemType}[]`;
  }
  if (schema.type === "object" || schema.properties) {
    if (!schema.properties || Object.keys(schema.properties).length === 0) {
      return "Record<string, unknown>";
    }
    return emitInterfaceBody(schema, indent);
  }
  if (schema.type === "integer" || schema.type === "number") {
    return "number";
  }
  if (schema.type === "boolean") {
    return "boolean";
  }
  if (schema.type === "string") {
    return "string";
  }
  return "unknown";
};

const emitInterfaceBody = (schema: OpenApiSchema, indent: string): string => {
  const required = new Set(schema.required ?? []);
  const lines = Object.entries(schema.properties ?? {}).map(([key, property]) => {
    const optional = required.has(key) ? "" : "?";
    const type = tsTypeFromSchema(property, `${indent}  `);
    return `${indent}  ${key}${optional}: ${type};`;
  });
  return `{\n${lines.join("\n")}\n${indent}}`;
};

export const emitInterface = ({name, schema}: {name: string; schema: OpenApiSchema}): string => {
  if (schema.type === "object" || schema.properties) {
    return `export interface ${name} ${emitInterfaceBody(schema, "")}`;
  }
  return `export type ${name} = ${tsTypeFromSchema(schema, "")};`;
};
