import type {Model} from "mongoose";

import type {ModelRouterOptions} from "../api";
import {
  clearCollectionRegistry,
  listCollections,
  registerCollection,
  replaceCollectionOptions,
} from "../collectionRegistry";
import type {RealtimeConfig} from "./types";

export interface RealtimeRegistryEntry {
  modelName: string;
  routePath: string;
  collectionName: string;
  config: RealtimeConfig;
  options: ModelRouterOptions<unknown>;
}

const toRealtimeEntry = (record: {
  model: Model<unknown>;
  options: ModelRouterOptions<unknown>;
  routePath: string;
}): RealtimeRegistryEntry => ({
  collectionName: record.model.collection.collectionName,
  config: record.options.realtime!,
  modelName: record.model.modelName,
  options: record.options,
  routePath: record.routePath,
});

const realtimeModelForEntry = (entry: RealtimeRegistryEntry): Model<unknown> => {
  const registered = listCollections().find((record) => record.routePath === entry.routePath)?.model;
  if (registered) {
    return registered;
  }
  return {
    collection: {collectionName: entry.collectionName},
    modelName: entry.modelName,
  } as Model<unknown>;
};

export const registerRealtime = (entry: RealtimeRegistryEntry): void => {
  registerCollection({
    model: realtimeModelForEntry(entry),
    options: {
      ...entry.options,
      realtime: entry.config,
    } as ModelRouterOptions<unknown>,
    routePath: entry.routePath,
  });
};

export const updateRealtimeRegistryOptions = (
  routePath: string,
  options: ModelRouterOptions<unknown>
): void => {
  replaceCollectionOptions(routePath, options);
};

export const getRealtimeRegistry = (): RealtimeRegistryEntry[] =>
  listCollections()
    .filter((record) => record.surfaces.realtime)
    .map(toRealtimeEntry);

export const findRegistryEntryByCollection = (
  collectionName: string
): RealtimeRegistryEntry | undefined => {
  return getRealtimeRegistry().find((entry) => entry.collectionName === collectionName);
};

export const findRegistryEntryByRoutePath = (
  collection: string
): RealtimeRegistryEntry | undefined => {
  return getRealtimeRegistry().find(
    (entry) => entry.routePath === `/${collection}` || entry.routePath === collection
  );
};

export const clearRealtimeRegistry = (): void => {
  clearCollectionRegistry();
};
