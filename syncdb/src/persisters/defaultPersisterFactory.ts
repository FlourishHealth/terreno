import type {MergeableStore} from "tinybase";

import {createMemoryPersister} from "./memoryPersister";
import type {DefaultPersisterOptions, SyncDbPersister, SyncDbPersisterFactory} from "./types";

/**
 * Neutral fallback used under Node/Bun/SSR where neither expo-sqlite nor
 * localStorage is available. Metro resolves the platform-specific
 * `.native`/`.web` variants for real apps; this in-memory factory keeps the
 * client usable (non-persistent) everywhere else.
 */
export const createDefaultPersisterFactory = (
  _options: DefaultPersisterOptions = {}
): SyncDbPersisterFactory => {
  return (store: MergeableStore): SyncDbPersister => createMemoryPersister(store, {});
};
