import type {Model} from "mongoose";

import type {ModelRouterOptions} from "./api";
import {applySyncRegistrationSideEffects} from "./sync/registrationSideEffects";

export interface CollectionSurfaces {
  mcp: boolean;
  realtime: boolean;
  sync: boolean;
}

export interface CollectionRecord<T = unknown> {
  model: Model<T>;
  options: ModelRouterOptions<T>;
  routePath: string;
  surfaces: CollectionSurfaces;
}

const collectionRegistry = new Map<string, CollectionRecord>();

const deriveSurfaces = (
  options: ModelRouterOptions<unknown>,
  existing?: CollectionSurfaces
): CollectionSurfaces => ({
  mcp: Boolean(options.mcp) || (existing?.mcp ?? false),
  realtime: Boolean(options.realtime) || (existing?.realtime ?? false),
  sync: Boolean(options.sync) || (existing?.sync ?? false),
});

export const registerCollection = <T>({
  model,
  options,
  routePath,
}: {
  model: Model<T>;
  options: ModelRouterOptions<T>;
  routePath: string;
}): void => {
  const existing = collectionRegistry.get(routePath);
  const wasSyncEnabled = existing?.surfaces.sync ?? false;

  if (options.sync && !wasSyncEnabled) {
    applySyncRegistrationSideEffects({
      config: options.sync,
      existingSyncEntries: listCollections()
        .filter((record) => record.surfaces.sync)
        .map((record) => ({
          collectionTag: record.routePath.replace(/^\//, ""),
          modelName: record.model.modelName,
        })),
      model,
      options,
      routePath,
    });
  }

  collectionRegistry.set(routePath, {
    model,
    options,
    routePath,
    surfaces: deriveSurfaces(options as ModelRouterOptions<unknown>, existing?.surfaces),
  });
};

export const replaceCollectionOptions = (
  routePath: string,
  options: ModelRouterOptions<unknown>
): void => {
  const existing = collectionRegistry.get(routePath);
  if (!existing) {
    return;
  }
  existing.options = options;
};

export const getCollection = (routePath: string): CollectionRecord | undefined =>
  collectionRegistry.get(routePath);

export const listCollections = (): CollectionRecord[] =>
  Array.from(collectionRegistry.values());

export const clearCollectionRegistry = (): void => {
  collectionRegistry.clear();
};
