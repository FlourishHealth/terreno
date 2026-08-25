/**
 * Schema and Mongo work that must happen when a collection first becomes
 * sync-enabled — kept out of CollectionRegistry so catalog writes stay a
 * Map update, while models can still register before Mongo is connected.
 *
 * Registration only validates the schema and queues index creation.
 * TerrenoApp.start() (or a host that builds Express without it) must later
 * await ensureSyncIndexes() so snapshot/catch-up queries have their indexes.
 */
import type {Model} from "mongoose";

import type {ModelRouterOptions} from "../api";
import {APIError} from "../errors";
import {logger} from "../logger";
import {getScopeField} from "./streams";
import type {SyncConfig} from "./types";

type IndexCreationTask = () => Promise<void>;
const indexCreationTasks: IndexCreationTask[] = [];

export interface SyncRegistrationSnapshot {
  collectionTag: string;
  modelName: string;
}

/** Queue extra index work (tests and SyncApp bookkeeping models). */
export const trackSyncIndexCreation = (task: IndexCreationTask): void => {
  indexCreationTasks.push(task);
};

/**
 * Fail loud if the model cannot participate in sync, then queue the
 * snapshot index. Call only on the first sync enable for a routePath.
 */
export const applySyncRegistrationSideEffects = <T>({
  config,
  existingSyncEntries,
  model,
  routePath,
}: {
  config: SyncConfig;
  existingSyncEntries: SyncRegistrationSnapshot[];
  model: Model<T>;
  options: ModelRouterOptions<T>;
  routePath: string;
}): void => {
  const name = model.modelName;
  const deletedPath = model.schema.path("deleted");
  if (deletedPath?.instance !== "Boolean") {
    throw new APIError({
      status: 500,
      title:
        `Model ${name} has a sync config but no soft delete support. ` +
        "Apply isDeletedPlugin to the schema — sync catch-up requires delete tombstones.",
    });
  }
  if (!model.schema.path("_syncSeq")) {
    throw new APIError({
      status: 500,
      title:
        `Model ${name} has a sync config but syncPlugin is not applied to its schema. ` +
        "Apply syncPlugin so every write stamps a per-stream _syncSeq.",
    });
  }
  const scopeField = getScopeField(config.scope);
  if (scopeField && !model.schema.path(scopeField)) {
    throw new APIError({
      status: 500,
      title: `Model ${name} has a sync scope on field "${scopeField}" but the schema has no such path.`,
    });
  }
  if (typeof config.scope === "function" && !config.snapshotFilter) {
    throw new APIError({
      status: 500,
      title:
        `Model ${name} uses a custom sync scope resolver, which requires a snapshotFilter ` +
        "so the snapshot endpoint can restrict queries to the caller's documents.",
    });
  }
  if (existingSyncEntries.some((entry) => entry.modelName === name)) {
    throw new APIError({
      status: 500,
      title: `Model ${name} is already registered for sync.`,
    });
  }
  const collectionTag = routePath.replace(/^\//, "");
  if (existingSyncEntries.some((entry) => entry.collectionTag === collectionTag)) {
    throw new APIError({
      status: 500,
      title:
        `Sync collection tag "${collectionTag}" is already registered (routePath ${routePath}). ` +
        "Each synced model must have a unique route path.",
    });
  }

  (model as unknown as {bulkWrite: () => never}).bulkWrite = (): never => {
    throw new APIError({
      status: 500,
      title:
        `bulkWrite is not supported on sync-enabled model ${name}: it bypasses Mongoose ` +
        "middleware, so writes are never stamped with a per-stream _syncSeq and become " +
        "invisible to sync delta emission and snapshot catch-up. Loop per document instead.",
    });
  };

  const indexSpec: Record<string, 1> = scopeField ? {[scopeField]: 1, _syncSeq: 1} : {_syncSeq: 1};
  indexCreationTasks.push(async () => {
    try {
      await model.collection.createIndex(indexSpec);
    } catch (error: unknown) {
      logger.error(`[sync] Failed to create sync index for ${name}`, {error: String(error)});
      throw new APIError({
        status: 500,
        title:
          `Failed to create sync snapshot index for ${name}: ${String(error)}. ` +
          "The snapshot/catch-up query requires this index; fix the schema/DB and restart.",
      });
    }
  });
};

/** Create every queued sync index after Mongo is connected. */
export const ensureSyncIndexes = async (): Promise<void> => {
  await Promise.all(indexCreationTasks.map((task) => task()));
};

/** Drop queued index work when the collection catalog is wiped (tests). */
export const clearSyncIndexCreationTasks = (): void => {
  indexCreationTasks.length = 0;
};
