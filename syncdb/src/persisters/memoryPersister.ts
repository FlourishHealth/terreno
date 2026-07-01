import type {MergeableStore} from "tinybase";

import type {SyncDbPersister, SyncDbPersisterFactory} from "./types";

/** Mutable backing slot shared between persister instances. */
export interface MemoryStorage {
  content?: ReturnType<MergeableStore["getMergeableContent"]>;
}

/**
 * In-memory persister. Primarily used for tests and SSR/no-storage fallbacks.
 * It preserves the full mergeable (CRDT) content so reloading into a fresh store
 * retains hybrid-logical-clock metadata, mirroring real persister behavior.
 */
export const createMemoryPersister = (
  store: MergeableStore,
  backing: MemoryStorage
): SyncDbPersister => {
  let autoSaveListenerId: string | undefined;

  const save = async (): Promise<void> => {
    backing.content = store.getMergeableContent();
  };

  const load = async (): Promise<void> => {
    if (!backing.content) {
      return;
    }
    store.setMergeableContent(backing.content);
  };

  const startAutoSave = async (): Promise<void> => {
    await save();
    autoSaveListenerId = store.addDidFinishTransactionListener(() => {
      backing.content = store.getMergeableContent();
    });
  };

  const stopAutoSave = (): void => {
    if (autoSaveListenerId) {
      store.delListener(autoSaveListenerId);
      autoSaveListenerId = undefined;
    }
  };

  const destroy = (): void => {
    stopAutoSave();
  };

  return {destroy, load, save, startAutoSave, stopAutoSave};
};

/**
 * Build a persister factory backed by a shared in-memory slot. Passing the same
 * `backing` object to multiple stores lets them share persisted state, which is
 * how the round-trip tests emulate cross-session persistence.
 */
export const createMemoryPersisterFactory = (
  backing: MemoryStorage = {}
): SyncDbPersisterFactory => {
  return (store: MergeableStore): SyncDbPersister => createMemoryPersister(store, backing);
};
