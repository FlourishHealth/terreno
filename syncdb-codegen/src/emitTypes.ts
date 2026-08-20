import type {OpenApiDocument, OpenApiSchema} from "./types";

const refName = (ref: string): string => {
  const parts = ref.split("/");
  return parts[parts.length - 1] ?? ref;
};

const resolveSchema = (schema: OpenApiSchema, doc: OpenApiDocument, stack: Set<string>): OpenApiSchema => {
  if (schema.$ref) {
    const name = refName(schema.$ref);
    if (stack.has(name)) {
      return schema;
    }
    const resolved = doc.components?.schemas?.[name];
    if (!resolved) {
      throw new Error(`Unresolved schema reference: ${schema.$ref}`);
    }
    return resolveSchema(resolved, doc, new Set([...stack, name]));
  }
  return schema;
};

const schemaToTs = (schema: OpenApiSchema, doc: OpenApiDocument, stack: Set<string>): string => {
  const resolved = resolveSchema(schema, doc, stack);

  if (resolved.$ref) {
    return refName(resolved.$ref);
  }

  if (resolved.enum && resolved.enum.length > 0) {
    return resolved.enum.map((value) => JSON.stringify(value)).join(" | ");
  }

  if (resolved.type === "array" && resolved.items) {
    return `${schemaToTs(resolved.items, doc, stack)}[]`;
  }

  if (resolved.oneOf && resolved.oneOf.length > 0) {
    return resolved.oneOf.map((part) => schemaToTs(part, doc, stack)).join(" | ");
  }

  switch (resolved.type) {
    case "string":
      return "string";
    case "number":
    case "integer":
      return "number";
    case "boolean":
      return "boolean";
    case "object": {
      if (!resolved.properties) {
        return "Record<string, unknown>";
      }
      const required = new Set(resolved.required ?? []);
      const lines = Object.entries(resolved.properties).map(([key, value]) => {
        const optional = required.has(key) ? "" : "?";
        return `  ${key}${optional}: ${schemaToTs(value, doc, stack)};`;
      });
      return `{\n${lines.join("\n")}\n}`;
    }
    default:
      return "unknown";
  }
};

export const emitInterface = (
  name: string,
  schema: OpenApiSchema,
  doc: OpenApiDocument
): string => {
  const resolved = resolveSchema(schema, doc, new Set());
  if (!resolved.properties) {
    return `export type ${name} = ${schemaToTs(resolved, doc, new Set())};`;
  }

  const required = new Set(resolved.required ?? []);
  const lines = Object.entries(resolved.properties).map(([key, value]) => {
    const optional = required.has(key) ? "" : "?";
    return `  ${key}${optional}: ${schemaToTs(value, doc, new Set())};`;
  });
  return `export interface ${name} {\n${lines.join("\n")}\n}`;
};

export const emitPartialType = (name: string, baseName: string): string =>
  `export type ${name} = Partial<${baseName}>;`;

export const collectSchemaRefs = (names: string[], doc: OpenApiDocument): string[] => {
  const emitted = new Set<string>();
  const lines: string[] = [];

  for (const name of names) {
    if (emitted.has(name)) {
      continue;
    }
    const schema = doc.components?.schemas?.[name];
    if (!schema) {
      continue;
    }
    emitted.add(name);
    lines.push(emitInterface(name, schema, doc));
  }

  return lines;
};
