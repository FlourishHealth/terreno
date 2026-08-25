import type {Model} from "mongoose";

import type {ModelRouterOptions} from "../api";
import {
  clearCollectionRegistry,
  listCollections,
  registerCollection,
  replaceCollectionOptions,
} from "../collectionRegistry";
import {logger} from "../logger";
import {
  clearSyncIndexCreationTasks,
  ensureSyncIndexes,
  trackSyncIndexCreation,
} from "./registrationSideEffects";
import type {SyncConfig} from "./types";

export interface SyncRegistryEntry {
  modelName: string;
  routePath: string;
  collectionTag: string;
  collectionName: string;
  config: SyncConfig;
  options: ModelRouterOptions<unknown>;
}

const toSyncEntry = (record: {
  model: Model<unknown>;
  options: ModelRouterOptions<unknown>;
  routePath: string;
}): SyncRegistryEntry => ({
  collectionName: record.model.collection.collectionName,
  collectionTag: record.routePath.replace(/^\//, ""),
  config: record.options.sync as SyncConfig,
  modelName: record.model.modelName,
  options: record.options,
  routePath: record.routePath,
});

const syncCollections = () =>
  listCollections()
    .filter((record) => record.surfaces.sync)
    .map(toSyncEntry);

export {ensureSyncIndexes, trackSyncIndexCreation};

export const registerSync = <T>({
  model,
  routePath,
  config,
  options,
}: {
  model: Model<T>;
  routePath: string;
  config: SyncConfig;
  options: ModelRouterOptions<T>;
}): void => {
  registerCollection({
    model,
    options: {
      ...options,
      sync: config,
    } as ModelRouterOptions<T>,
    routePath,
  });
};

export const updateSyncRegistryOptions = (
  routePath: string,
  options: ModelRouterOptions<unknown>
): void => {
  replaceCollectionOptions(routePath, options);
};

export const getSyncRegistry = (): SyncRegistryEntry[] => syncCollections();

const scopesRequiringFullUser = (): string[] =>
  syncCollections()
    .filter(
      (entry) => typeof entry.config.scope === "function" || entry.config.scope.type === "tenant"
    )
    .map((entry) => entry.collectionTag);

export const warnOnSyncScopesWithoutUserModel = ({userModel}: {userModel?: unknown}): string[] => {
  if (userModel) {
    return [];
  }
  const collections = scopesRequiringFullUser();
  if (collections.length === 0) {
    return [];
  }
  logger.error(
    "[sync] Tenant/custom-scoped sync collections are registered but RealtimeApp has no " +
      "userModel: socket authorization will fall back to the synthetic JWT-claim user, which " +
      "carries no membership fields, so tenant streams resolve to nothing and `admin` is " +
      "trusted from the token instead of the database. Pass `userModel` in RealtimeAppOptions " +
      "(TerrenoApp does this automatically for its own userModel).",
    {collections}
  );
  return collections;
};

export const findSyncEntryByModelName = (modelName: string): SyncRegistryEntry | undefined =>
  syncCollections().find((entry) => entry.modelName === modelName);

export const findSyncEntryByCollectionTag = (
  collectionTag: string
): SyncRegistryEntry | undefined =>
  syncCollections().find((entry) => entry.collectionTag === collectionTag);

export const findSyncEntryByCollectionName = (
  collectionName: string
): SyncRegistryEntry | undefined =>
  syncCollections().find((entry) => entry.collectionName === collectionName);

export const clearSyncRegistry = (): void => {
  clearCollectionRegistry();
  clearSyncIndexCreationTasks();
};
