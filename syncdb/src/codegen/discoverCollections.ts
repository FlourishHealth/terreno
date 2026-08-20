import {refName, toPascalCase} from "./hookNames";
import type {DiscoveredCollection, OpenApiDocument, OpenApiSchema} from "./types";

const jsonContentSchema = (
  content?: Record<string, {schema?: OpenApiSchema}>
): OpenApiSchema | undefined => content?.["application/json"]?.schema;

const listItemSchema = (operationSchema: OpenApiSchema | undefined): OpenApiSchema | undefined => {
  const items = operationSchema?.properties?.data?.items;
  if (items) {
    return items;
  }
  return operationSchema;
};

const resolveSchema = (spec: OpenApiDocument, schema: OpenApiSchema | undefined): OpenApiSchema => {
  if (!schema) {
    return {properties: {}, type: "object"};
  }
  if (schema.$ref) {
    const name = refName(schema.$ref);
    const resolved = name ? spec.components?.schemas?.[name] : undefined;
    if (resolved) {
      return resolved;
    }
  }
  return schema;
};

const fallbackEntityName = (collection: string): string => {
  const pascal = toPascalCase(collection);
  if (pascal.endsWith("s") && pascal.length > 1) {
    return pascal.slice(0, -1);
  }
  return pascal;
};

const fromExtension = (
  spec: OpenApiDocument,
  path: string,
  collection: string
): DiscoveredCollection => {
  const item = spec.paths?.[path];
  const entitySchemaRaw = listItemSchema(jsonContentSchema(item?.get?.responses?.["200"]?.content));
  const entityName = refName(entitySchemaRaw?.$ref) ?? fallbackEntityName(collection);
  const createSchemaRaw = jsonContentSchema(item?.post?.requestBody?.content);
  const collectionPath = path.endsWith("/") ? path.slice(0, -1) : path;
  const exactIdPath = `${collectionPath}/{id}`;
  const pathNames = Object.keys(spec.paths ?? {});
  const idPath = pathNames.includes(exactIdPath)
    ? exactIdPath
    : pathNames.find((candidate) => {
        if (!candidate.startsWith(`${collectionPath}/`)) {
          return false;
        }
        return /^\{[^/]+\}$/.test(candidate.slice(collectionPath.length + 1));
      });
  const patchOp = idPath ? spec.paths?.[idPath]?.patch : undefined;
  const updateSchemaRaw = jsonContentSchema(patchOp?.requestBody?.content);
  return {
    collection,
    createName: refName(createSchemaRaw?.$ref) ?? `Create${entityName}Body`,
    createSchema: resolveSchema(spec, createSchemaRaw),
    entityName,
    entitySchema: resolveSchema(spec, entitySchemaRaw),
    updateName: refName(updateSchemaRaw?.$ref) ?? `Update${entityName}Body`,
    updateSchema: resolveSchema(spec, updateSchemaRaw),
  };
};

const emptyCollection = (collection: string): DiscoveredCollection => {
  const entityName = fallbackEntityName(collection);
  return {
    collection,
    createName: `Create${entityName}Body`,
    createSchema: {properties: {}, type: "object"},
    entityName,
    entitySchema: {properties: {}, type: "object"},
    updateName: `Update${entityName}Body`,
    updateSchema: {properties: {}, type: "object"},
  };
};

export const discoverCollections = ({
  spec,
  collections,
}: {
  spec: OpenApiDocument;
  collections?: string[];
}): DiscoveredCollection[] => {
  const fromSpec: DiscoveredCollection[] = [];
  for (const [path, item] of Object.entries(spec.paths ?? {})) {
    const extension = item.get?.["x-terreno-sync"];
    if (!extension?.collection) {
      continue;
    }
    fromSpec.push(fromExtension(spec, path, extension.collection));
  }

  if (fromSpec.length === 0) {
    if (collections && collections.length > 0) {
      return collections.map(emptyCollection);
    }
    throw new Error(
      "No synced collections found. Add x-terreno-sync to list operations " +
        "(modelRouter sync: {...}) or pass --collections todos,notes."
    );
  }

  if (!collections || collections.length === 0) {
    return fromSpec;
  }

  const allow = new Set(collections);
  const filtered = fromSpec.filter((entry) => allow.has(entry.collection));
  if (filtered.length === 0) {
    throw new Error(
      `No synced collections matched --collections ${collections.join(",")}. ` +
        "Check x-terreno-sync on list operations in the OpenAPI spec."
    );
  }
  return filtered;
};
