import type {MergeableStore} from "tinybase";

import type {PayloadCodec} from "../crypto/types";
import {createKvPersister, type KeyValueStorage} from "./kvPersister";
import type {SyncDbPersister, SyncDbPersisterFactory} from "./types";

/**
 * Web localStorage adapter for {@link createKvPersister}. Throws if localStorage
 * is unavailable (e.g. SSR) so callers can fall back deliberately.
 */
export const createLocalStorageAdapter = (): KeyValueStorage => {
  const storage = globalThis.localStorage;
  if (!storage) {
    throw new Error("localStorage is unavailable in this environment");
  }
  return {
    getItem: async (key: string): Promise<string | null> => storage.getItem(key),
    removeItem: async (key: string): Promise<void> => {
      storage.removeItem(key);
    },
    setItem: async (key: string, value: string): Promise<void> => {
      storage.setItem(key, value);
    },
  };
};

/**
 * Build a persister factory that encrypts the store at rest using the supplied
 * codec and key-value storage. Opt into encryption by passing the result as the
 * client's `persisterFactory`.
 */
export const createEncryptedPersisterFactory = ({
  codec,
  storage,
  databaseName = "terreno-syncdb",
}: {
  codec: PayloadCodec;
  storage: KeyValueStorage;
  databaseName?: string;
}): SyncDbPersisterFactory => {
  return (store: MergeableStore): SyncDbPersister =>
    createKvPersister({codec, key: databaseName, storage, store});
};
