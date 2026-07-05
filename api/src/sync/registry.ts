// biome-ignore-all lint/suspicious/noExplicitAny: model router options are generic across all models
import type {Model} from "mongoose";
import type {ModelRouterOptions} from "../api";
import {logger} from "../logger";
import {getScopeField} from "./streams";
import type {SyncConfig} from "./types";

/**
 * A registered model with SyncDB local-first sync configuration.
 */
export interface SyncRegistryEntry {
  /** Mongoose model name (e.g. "Todo") */
  modelName: string;
  /** Route path (e.g. "/todos") */
  routePath: string;
  /** Collection tag used in the sync protocol (route path without the leading slash) */
  collectionTag: string;
  /** MongoDB collection name (e.g. "todos") */
  collectionName: string;
  /** Sync configuration from modelRouter options */
  config: SyncConfig;
  /** Full modelRouter options (for responseHandler, permissions, etc.) */
  options: ModelRouterOptions<any>;
}

const syncRegistry: SyncRegistryEntry[] = [];

/**
 * Register a model for local-first sync. Called automatically by modelRouter when the
 * `sync` option is provided. Validates the schema contract at startup and throws with
 * an actionable message when it is not met:
 * - soft delete (`isDeletedPlugin`) is required so deletes remain queryable tombstones;
 * - `syncPlugin` is required so every write stamps a per-stream `_syncSeq`;
 * - owner/tenant scope fields must exist on the schema.
 */
export const registerSync = ({
  model,
  routePath,
  config,
  options,
}: {
  model: Model<any>;
  routePath: string;
  config: SyncConfig;
  options: ModelRouterOptions<any>;
}): void => {
  const name = model.modelName;
  const deletedPath = model.schema.path("deleted");
  if (!deletedPath || deletedPath.instance !== "Boolean") {
    throw new Error(
      `Model ${name} has a sync config but no soft delete support. ` +
        "Apply isDeletedPlugin to the schema — sync catch-up requires delete tombstones."
    );
  }
  if (!model.schema.path("_syncSeq")) {
    throw new Error(
      `Model ${name} has a sync config but syncPlugin is not applied to its schema. ` +
        "Apply syncPlugin so every write stamps a per-stream _syncSeq."
    );
  }
  const scopeField = getScopeField(config.scope);
  if (scopeField && !model.schema.path(scopeField)) {
    throw new Error(
      `Model ${name} has a sync scope on field "${scopeField}" but the schema has no such path.`
    );
  }
  if (typeof config.scope === "function" && !config.snapshotFilter) {
    throw new Error(
      `Model ${name} uses a custom sync scope resolver, which requires a snapshotFilter ` +
        "so the snapshot endpoint can restrict queries to the caller's documents."
    );
  }
  if (syncRegistry.some((entry) => entry.modelName === name)) {
    throw new Error(`Model ${name} is already registered for sync.`);
  }

  syncRegistry.push({
    collectionName: model.collection.collectionName,
    collectionTag: routePath.replace(/^\//, ""),
    config,
    modelName: name,
    options,
    routePath,
  });

  // Compound index for snapshot/catch-up queries: {scopeField, _syncSeq}. Created
  // directly on the collection because the model is already compiled at registration.
  const indexSpec: Record<string, 1> = scopeField ? {[scopeField]: 1, _syncSeq: 1} : {_syncSeq: 1};
  void model.collection.createIndex(indexSpec).catch((error: unknown) => {
    logger.warn(`[sync] Failed to create sync index for ${name}`, {error: String(error)});
  });
};

/** Get all registered sync models. */
export const getSyncRegistry = (): SyncRegistryEntry[] => syncRegistry;

/** Find a sync registry entry by Mongoose model name. */
export const findSyncEntryByModelName = (modelName: string): SyncRegistryEntry | undefined =>
  syncRegistry.find((entry) => entry.modelName === modelName);

/** Find a sync registry entry by collection tag (e.g. "todos"). */
export const findSyncEntryByCollectionTag = (
  collectionTag: string
): SyncRegistryEntry | undefined =>
  syncRegistry.find((entry) => entry.collectionTag === collectionTag);

/** Find a sync registry entry by MongoDB collection name. */
export const findSyncEntryByCollectionName = (
  collectionName: string
): SyncRegistryEntry | undefined =>
  syncRegistry.find((entry) => entry.collectionName === collectionName);

/** Clear the registry (for testing). */
export const clearSyncRegistry = (): void => {
  syncRegistry.length = 0;
};
