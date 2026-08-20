import type {CodegenConfigFile, DiscoveredCollection, OpenApiDocument, OpenApiSchema} from "./types";

const refName = (ref: string): string => {
  const parts = ref.split("/");
  return parts[parts.length - 1] ?? ref;
};

const resolveRef = (schema: OpenApiSchema, doc: OpenApiDocument): OpenApiSchema => {
  if (!schema.$ref) {
    return schema;
  }
  const name = refName(schema.$ref);
  const resolved = doc.components?.schemas?.[name];
  if (!resolved) {
    throw new Error(`Unresolved schema reference: ${schema.$ref}`);
  }
  return resolved;
};

const getListEntitySchemaName = (
  operation: OpenApiDocument["paths"][string]["get"],
  doc: OpenApiDocument
): string => {
  const listSchema = operation?.responses?.["200"]?.content?.["application/json"]?.schema;
  const itemsRef = listSchema?.properties?.data?.items?.$ref;
  if (!itemsRef) {
    throw new Error("List operation is missing data.items $ref");
  }
  return refName(itemsRef);
};

const getRequestBodySchemaName = (
  operation: OpenApiDocument["paths"][string]["post"] | OpenApiDocument["paths"][string]["patch"],
  doc: OpenApiDocument
): string | undefined => {
  const bodySchema = operation?.requestBody?.content?.["application/json"]?.schema;
  if (!bodySchema) {
    return undefined;
  }
  if (bodySchema.$ref) {
    return refName(bodySchema.$ref);
  }
  return undefined;
};

const normalizePath = (path: string): string => path.replace(/\/$/, "");

const collectionFromPath = (path: string): string => {
  const trimmed = normalizePath(path);
  const segment = trimmed.split("/").filter(Boolean)[0];
  if (!segment) {
    throw new Error(`Cannot derive collection from path: ${path}`);
  }
  return segment;
};

const getPatchSchemaNameForCollection = (
  doc: OpenApiDocument,
  listPath: string
): string | undefined => {
  const candidates = [`${listPath}/{id}`, `${listPath}/{_id}`];
  for (const candidate of candidates) {
    const patchOp = doc.paths[candidate]?.patch ?? doc.paths[`${candidate}/`]?.patch;
    const schemaName = getRequestBodySchemaName(patchOp, doc);
    if (schemaName) {
      return schemaName;
    }
  }
  return undefined;
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

    const entitySchemaName = getListEntitySchemaName(listOp, doc);
    const createSchemaName = getRequestBodySchemaName(methods.post, doc);
    const updateSchemaName = getPatchSchemaNameForCollection(doc, normalizePath(path));

    discovered.push({
      collection: extension.collection,
      createSchemaName,
      entitySchemaName,
      listPath: normalizePath(path),
      scope: extension.scope,
      updateSchemaName,
    });
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

    const entitySchemaName = getListEntitySchemaName(methods.get, doc);
    const createSchemaName = getRequestBodySchemaName(methods.post, doc);
    const updateSchemaName = getPatchSchemaNameForCollection(doc, normalizePath(listPath));

    discovered.push({
      collection,
      createSchemaName,
      entitySchemaName,
      listPath: normalizePath(listPath),
      scope: "unknown",
      updateSchemaName,
    });
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

  let discovered = fromExtensions;
  if (discovered.length === 0) {
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

export const deriveCreateBodyName = (entitySchemaName: string): string => `Create${entitySchemaName}Body`;

export const deriveUpdateBodyName = (entitySchemaName: string): string => `Update${entitySchemaName}Body`;
