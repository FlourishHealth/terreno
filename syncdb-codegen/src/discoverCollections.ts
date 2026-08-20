import {toPascalCase} from "./deriveHookNames";
import {assertTsIdentifier} from "./safeIdentifiers";
import type {
  CodegenConfigFile,
  DiscoveredCollection,
  OpenApiDocument,
  OpenApiSchema,
} from "./types";

const refName = (ref: string): string => {
  const parts = ref.split("/");
  return parts[parts.length - 1] ?? ref;
};

const singularizeCollection = (collection: string): string => {
  if (collection.length > 1 && collection.endsWith("s")) {
    return collection.slice(0, -1);
  }
  return collection;
};

export const deriveEntityName = (collection: string): string =>
  toPascalCase(singularizeCollection(collection));

const resolveNamedSchema = (
  schema: OpenApiSchema | undefined,
  doc: OpenApiDocument,
  fallbackName: string
): {name: string; schema: OpenApiSchema} | undefined => {
  if (!schema) {
    return undefined;
  }
  if (schema.$ref) {
    const name = assertTsIdentifier({label: "schema $ref", value: refName(schema.$ref)});
    const resolved = doc.components?.schemas?.[name];
    if (!resolved) {
      throw new Error(`Unresolved schema reference: ${schema.$ref}`);
    }
    return {name, schema: resolved};
  }
  if (schema.type === "object" || schema.properties) {
    return {name: fallbackName, schema};
  }
  return undefined;
};

const getListItemSchema = (
  operation: OpenApiDocument["paths"][string]["get"]
): OpenApiSchema | undefined =>
  operation?.responses?.["200"]?.content?.["application/json"]?.schema?.properties?.data?.items;

const getRequestBodySchema = (
  operation: OpenApiDocument["paths"][string]["post"] | OpenApiDocument["paths"][string]["patch"]
): OpenApiSchema | undefined => operation?.requestBody?.content?.["application/json"]?.schema;

const normalizePath = (path: string): string => path.replace(/\/$/, "");

const getPatchBodySchema = (doc: OpenApiDocument, listPath: string): OpenApiSchema | undefined => {
  const candidates = [`${listPath}/{id}`, `${listPath}/{_id}`];
  for (const candidate of candidates) {
    const patchOp = doc.paths[candidate]?.patch ?? doc.paths[`${candidate}/`]?.patch;
    const schema = getRequestBodySchema(patchOp);
    if (schema) {
      return schema;
    }
  }
  return undefined;
};

const hasTerrenoSyncExtensions = (doc: OpenApiDocument): boolean => {
  for (const methods of Object.values(doc.paths)) {
    if (methods.get?.["x-terreno-sync"]) {
      return true;
    }
  }
  return false;
};

const buildCollection = (
  doc: OpenApiDocument,
  collection: string,
  listPath: string,
  scope: string
): DiscoveredCollection => {
  const collectionName = assertTsIdentifier({label: "collection", value: collection});
  const entityFallback = deriveEntityName(collectionName);
  const listItem = getListItemSchema(doc.paths[listPath]?.get ?? doc.paths[`${listPath}/`]?.get);
  const entity = resolveNamedSchema(listItem, doc, entityFallback);
  if (!entity) {
    throw new Error(
      `List operation for "${collectionName}" is missing an inline or $ref item schema at ${listPath}`
    );
  }

  const createFallback = `Create${entity.name}`;
  const updateFallback = `Update${entity.name}`;
  const create = resolveNamedSchema(
    getRequestBodySchema(doc.paths[listPath]?.post ?? doc.paths[`${listPath}/`]?.post),
    doc,
    createFallback
  );
  const update = resolveNamedSchema(getPatchBodySchema(doc, listPath), doc, updateFallback);

  return {
    collection: collectionName,
    createSchema: create?.schema,
    createSchemaName: create?.name,
    entitySchema: entity.schema,
    entitySchemaName: assertTsIdentifier({label: "entity schema name", value: entity.name}),
    listPath: normalizePath(listPath),
    scope,
    updateSchema: update?.schema,
    updateSchemaName: update?.name,
  };
};

const discoverFromExtension = (
  doc: OpenApiDocument,
  allowedCollections?: Set<string>
): DiscoveredCollection[] => {
  const discovered: DiscoveredCollection[] = [];

  for (const [path, methods] of Object.entries(doc.paths)) {
    const listOp = methods.get;
    const extension = listOp?.["x-terreno-sync"];
    if (!extension) {
      continue;
    }

    if (allowedCollections && !allowedCollections.has(extension.collection)) {
      continue;
    }

    discovered.push(
      buildCollection(doc, extension.collection, normalizePath(path), extension.scope)
    );
  }

  return discovered;
};

const discoverFromFallback = (
  doc: OpenApiDocument,
  collections: string[]
): DiscoveredCollection[] => {
  const discovered: DiscoveredCollection[] = [];

  for (const collection of collections) {
    const listPath = `/${collection}`;
    const methods = doc.paths[listPath] ?? doc.paths[`${listPath}/`];
    if (!methods?.get) {
      throw new Error(`No list operation found for collection "${collection}" at ${listPath}`);
    }
    discovered.push(buildCollection(doc, collection, listPath, "unknown"));
  }

  return discovered;
};

export const discoverCollections = ({
  doc,
  collectionsArg,
  config,
}: {
  doc: OpenApiDocument;
  collectionsArg?: string[];
  config?: CodegenConfigFile;
}): DiscoveredCollection[] => {
  const allowed = collectionsArg ? new Set(collectionsArg) : undefined;
  const fromExtensions = discoverFromExtension(doc, allowed);
  const specHasExtensions = hasTerrenoSyncExtensions(doc);

  let discovered = fromExtensions;
  if (discovered.length === 0) {
    if (allowed && specHasExtensions) {
      throw new Error("No collections matched the provided --collections filter.");
    }
    if (!collectionsArg || collectionsArg.length === 0) {
      throw new Error(
        "No synced collections found. Add x-terreno-sync extensions to the OpenAPI spec or pass --collections."
      );
    }
    discovered = discoverFromFallback(doc, collectionsArg);
  }

  if (discovered.length === 0) {
    throw new Error("No collections matched the provided --collections filter.");
  }

  return discovered.map((entry) => {
    const retries = config?.overrides?.[entry.collection]?.retries;
    if (retries === undefined) {
      return entry;
    }
    return {...entry, retries};
  });
};

export const deriveCreateBodyName = (entitySchemaName: string): string =>
  `Create${entitySchemaName}Body`;

export const deriveUpdateBodyName = (entitySchemaName: string): string =>
  `Update${entitySchemaName}Body`;
