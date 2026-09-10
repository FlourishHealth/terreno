import type {Model, Document as MongooseDocument, SchemaType} from "mongoose";

export interface SchemaFieldCatalog {
  path: string;
  instance: string;
  required: boolean;
  unique: boolean;
}

export interface SchemaIndexCatalog {
  keys: Record<string, number | string>;
  unique: boolean;
}

export interface ModelSchemaCatalog {
  collection: string;
  modelName: string;
  fields: SchemaFieldCatalog[];
  indexes: SchemaIndexCatalog[];
}

export interface SchemaCatalog {
  models: Record<string, ModelSchemaCatalog>;
}

export type SchemaDiffKind =
  | "addIndex"
  | "dropIndex"
  | "addOptionalField"
  | "addRequiredField"
  | "addUniqueIndex"
  | "renameField";

export interface SchemaDiffOp {
  kind: SchemaDiffKind;
  safe: boolean;
  modelName: string;
  path?: string;
  fromPath?: string;
  toPath?: string;
  keys?: Record<string, number | string>;
}

export interface SchemaDiff {
  ops: SchemaDiffOp[];
}

const skipPaths = new Set(["_id", "__v"]);

const indexKey = (index: SchemaIndexCatalog): string => {
  return `${JSON.stringify(index.keys)}:${index.unique ? "u" : "n"}`;
};

const fieldMap = (fields: SchemaFieldCatalog[]): Map<string, SchemaFieldCatalog> => {
  return new Map(fields.map((field) => [field.path, field]));
};

export const buildSchemaCatalog = ({
  models,
}: {
  models: Model<MongooseDocument>[];
}): SchemaCatalog => {
  const catalog: SchemaCatalog = {models: {}};
  for (const model of models) {
    const fields: SchemaFieldCatalog[] = [];
    const paths = model.schema.paths as Record<string, SchemaType>;
    for (const path of Object.keys(paths)) {
      if (skipPaths.has(path)) {
        continue;
      }
      const schemaType = paths[path];
      const required = Boolean(schemaType.isRequired);
      const unique = Boolean((schemaType as {options?: {unique?: boolean}}).options?.unique);
      fields.push({
        instance: schemaType.instance || "Mixed",
        path,
        required,
        unique,
      });
    }
    fields.sort((a, b) => a.path.localeCompare(b.path));

    const indexes: SchemaIndexCatalog[] = model.schema
      .indexes()
      .map((entry) => {
        const [keys, options] = entry;
        return {
          keys: keys as Record<string, number | string>,
          unique: Boolean(options?.unique),
        };
      })
      .sort((a, b) => indexKey(a).localeCompare(indexKey(b)));

    catalog.models[model.modelName] = {
      collection: model.collection.collectionName,
      fields,
      indexes,
      modelName: model.modelName,
    };
  }
  return catalog;
};

export const diffSchemaCatalog = ({
  after,
  before,
}: {
  after: SchemaCatalog;
  before: SchemaCatalog;
}): SchemaDiff => {
  const ops: SchemaDiffOp[] = [];
  const modelNames = new Set([...Object.keys(before.models), ...Object.keys(after.models)]);

  for (const modelName of [...modelNames].sort()) {
    const beforeModel = before.models[modelName] ?? {
      collection: after.models[modelName]?.collection ?? modelName,
      fields: [],
      indexes: [],
      modelName,
    };
    const afterModel = after.models[modelName] ?? {
      collection: beforeModel.collection,
      fields: [],
      indexes: [],
      modelName,
    };

    const beforeFields = fieldMap(beforeModel.fields);
    const afterFields = fieldMap(afterModel.fields);
    const removed = beforeModel.fields.filter((field) => !afterFields.has(field.path));
    const added = afterModel.fields.filter((field) => !beforeFields.has(field.path));

    const usedRemoved = new Set<string>();
    const usedAdded = new Set<string>();
    for (const removedField of removed) {
      const match = added.find(
        (addedField) =>
          addedField.instance === removedField.instance && !usedAdded.has(addedField.path)
      );
      if (!match) {
        continue;
      }
      usedRemoved.add(removedField.path);
      usedAdded.add(match.path);
      ops.push({
        fromPath: removedField.path,
        kind: "renameField",
        modelName,
        safe: false,
        toPath: match.path,
      });
      if (match.required) {
        ops.push({
          kind: "addRequiredField",
          modelName,
          path: match.path,
          safe: false,
        });
      }
    }

    for (const field of added) {
      if (usedAdded.has(field.path)) {
        continue;
      }
      if (field.required) {
        ops.push({
          kind: "addRequiredField",
          modelName,
          path: field.path,
          safe: false,
        });
        continue;
      }
      ops.push({
        kind: "addOptionalField",
        modelName,
        path: field.path,
        safe: true,
      });
    }

    for (const field of afterModel.fields) {
      const previous = beforeFields.get(field.path);
      if (previous && !previous.required && field.required) {
        ops.push({
          kind: "addRequiredField",
          modelName,
          path: field.path,
          safe: false,
        });
      }
    }

    const beforeIndexes = new Set(beforeModel.indexes.map(indexKey));
    const afterIndexes = new Set(afterModel.indexes.map(indexKey));

    for (const index of afterModel.indexes) {
      if (beforeIndexes.has(indexKey(index))) {
        continue;
      }
      if (index.unique) {
        ops.push({
          keys: index.keys,
          kind: "addUniqueIndex",
          modelName,
          safe: false,
        });
        continue;
      }
      ops.push({
        keys: index.keys,
        kind: "addIndex",
        modelName,
        safe: true,
      });
    }

    for (const index of beforeModel.indexes) {
      if (afterIndexes.has(indexKey(index))) {
        continue;
      }
      ops.push({
        keys: index.keys,
        kind: "dropIndex",
        modelName,
        safe: true,
      });
    }
  }

  return {ops};
};
