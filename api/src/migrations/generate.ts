import {mkdir, writeFile} from "node:fs/promises";
import {join} from "node:path";

import {DateTime} from "luxon";
import type {Model, Document as MongooseDocument} from "mongoose";

import {APIError} from "../errors";
import {checkMigrationFiles} from "./load";
import {
  buildSchemaCatalog,
  diffSchemaCatalog,
  type SchemaCatalog,
  type SchemaDiffOp,
} from "./schemaCatalog";

export interface GenerateMigrationOptions {
  dir: string;
  models: Model<MongooseDocument>[];
  name?: string;
  now?: () => DateTime;
}

export interface GenerateMigrationResult {
  noop: boolean;
  path: string | null;
}

const emptyCatalog = (): SchemaCatalog => {
  return {models: {}};
};

const slugify = (name: string): string => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "auto";
};

export const lastSchemaAfter = (
  catalogs: Array<{schemaAfter?: unknown}>
): SchemaCatalog | undefined => {
  for (let index = catalogs.length - 1; index >= 0; index -= 1) {
    const snapshot = catalogs[index]?.schemaAfter;
    if (snapshot && typeof snapshot === "object") {
      return snapshot as SchemaCatalog;
    }
  }
  return undefined;
};

const renderUnsafeUp = (ops: SchemaDiffOp[]): string => {
  const detail = ops
    .filter((op) => !op.safe)
    .map((op) => `${op.kind} ${op.modelName} ${op.path ?? op.toPath ?? JSON.stringify(op.keys)}`)
    .join("; ");
  return `  throw new Error("Unsafe migration stub: ${detail}. Replace this stub with a backfill before applying.");`;
};

const mongoIndexName = (keys: Record<string, number | string>): string => {
  return Object.entries(keys)
    .map(([key, value]) => `${key}_${value}`)
    .join("_");
};

const renderIndexCall = ({
  collection,
  keys,
  kind,
}: {
  collection: string;
  keys: Record<string, number | string>;
  kind: "createIndex" | "dropIndex";
}): string => {
  const name = mongoIndexName(keys);
  if (kind === "dropIndex") {
    return `  await ctx.mongoose.connection.collection(${JSON.stringify(collection)}).dropIndex(${JSON.stringify(name)});`;
  }
  return `  await ctx.mongoose.connection.collection(${JSON.stringify(collection)}).createIndex(${JSON.stringify(keys)}, {name: ${JSON.stringify(name)}});`;
};

const renderSafeUp = (ops: SchemaDiffOp[], catalog: SchemaCatalog): string => {
  const lines: string[] = ["  if (ctx.dryRun) {", "    return;", "  }"];
  for (const op of ops) {
    const collection = catalog.models[op.modelName]?.collection ?? op.modelName;
    if (op.kind === "addIndex" && op.keys) {
      lines.push(renderIndexCall({collection, keys: op.keys, kind: "createIndex"}));
      continue;
    }
    if (op.kind === "dropIndex" && op.keys) {
      lines.push(renderIndexCall({collection, keys: op.keys, kind: "dropIndex"}));
      continue;
    }
    if (op.kind === "addOptionalField") {
      lines.push(
        `  // Optional field ${op.modelName}.${op.path} is schemaless in Mongo; snapshot only.`
      );
    }
  }
  return lines.join("\n");
};

const renderSafeDown = (ops: SchemaDiffOp[], catalog: SchemaCatalog): string => {
  const lines: string[] = ["  if (ctx.dryRun) {", "    return;", "  }"];
  for (const op of [...ops].reverse()) {
    const collection = catalog.models[op.modelName]?.collection ?? op.modelName;
    if (op.kind === "addIndex" && op.keys) {
      lines.push(renderIndexCall({collection, keys: op.keys, kind: "dropIndex"}));
      continue;
    }
    if (op.kind === "dropIndex" && op.keys) {
      lines.push(renderIndexCall({collection, keys: op.keys, kind: "createIndex"}));
    }
  }
  return lines.join("\n");
};

const renderFile = ({
  catalog,
  id,
  ops,
}: {
  catalog: SchemaCatalog;
  id: string;
  ops: SchemaDiffOp[];
}): string => {
  const unsafe = ops.some((op) => !op.safe);
  const upBody = unsafe ? renderUnsafeUp(ops) : renderSafeUp(ops, catalog);
  const downBody = unsafe ? renderUnsafeUp(ops) : renderSafeDown(ops, catalog);
  return `export const id = ${JSON.stringify(id)};

export const schemaAfter = ${JSON.stringify(catalog)};

export const up = async (ctx) => {
${upBody}
};

export const down = async (ctx) => {
${downBody}
};
`;
};

export const generateMigration = async ({
  dir,
  models,
  name = "auto",
  now = () => DateTime.now(),
}: GenerateMigrationOptions): Promise<GenerateMigrationResult> => {
  await mkdir(dir, {recursive: true});
  let previous = emptyCatalog();
  try {
    const loaded = await checkMigrationFiles({dir});
    previous = lastSchemaAfter(loaded) ?? emptyCatalog();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes("ENOENT")) {
      throw error;
    }
  }

  if (models.length === 0) {
    throw new APIError({
      detail: "Pass a --models module that exports models or {models: Model[]}.",
      status: 400,
      title: "No Mongoose models found",
    });
  }

  const catalog = buildSchemaCatalog({models});
  const diff = diffSchemaCatalog({after: catalog, before: previous});
  if (diff.ops.length === 0) {
    return {noop: true, path: null};
  }

  const id = `${now().toUTC().toFormat("yyyyMMddHHmmss")}-${slugify(name)}`;
  const path = join(dir, `${id}.ts`);
  await writeFile(path, renderFile({catalog, id, ops: diff.ops}), "utf8");
  return {noop: false, path};
};
