import type {AnyPersister} from "tinybase/persisters";

import {clearMemoryPersisterData} from "../persisters/memoryPersister";
import {deleteIdbDatabase} from "./idb";
import type {SyncStore} from "./store";

/**
 * Wipe all local sync data for a device/user: clear every store table and
 * value, overwrite the persisted snapshot with the now-empty content, release
 * the persister, and delete the named IndexedDB databases (persisted data and
 * cached encryption keys). Used on logout, on schema-version mismatch, and on
 * decrypt failure before re-bootstrapping.
 *
 * A MergeableStore keeps CRDT tombstones for cleared rows, so persisting the
 * emptied content still leaks row ids at rest — pass `databaseNames` so the
 * underlying databases are deleted outright.
 */
export const wipeLocalData = async ({
  store,
  persister,
  databaseNames = [],
  keyCacheDbNames = [],
}: {
  store: SyncStore;
  persister?: AnyPersister;
  /** databaseNames the store was persisted under; deleted entirely. */
  databaseNames?: string[];
  /** IndexedDB databases holding cached CryptoKeys; deleted entirely. */
  keyCacheDbNames?: string[];
}): Promise<void> => {
  store.raw.delTables();
  store.raw.delValues();
  if (persister) {
    // Overwrite the snapshot with the emptied content (covers persisters whose
    // backing store is not named in databaseNames, e.g. native SQLite), then
    // drain the persister's action queue so no in-flight autosave can recreate
    // data after the databases below are deleted.
    await persister.save();
    await persister.schedule(async () => {});
    await persister.destroy();
  }
  const hasIndexedDb = typeof globalThis.indexedDB !== "undefined";
  for (const databaseName of [...databaseNames, ...keyCacheDbNames]) {
    clearMemoryPersisterData({databaseName});
    if (hasIndexedDb) {
      await deleteIdbDatabase({databaseName});
    }
  }
};
