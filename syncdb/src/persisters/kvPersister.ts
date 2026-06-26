import type {MergeableStore} from "tinybase";

import {identityCodec} from "../crypto/identityCodec";
import type {PayloadCodec} from "../crypto/types";
import type {SyncDbPersister} from "./types";

/** Minimal async key-value storage backend (localStorage, AsyncStorage, etc.). */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem?(key: string): Promise<void>;
}

const DEFAULT_KEY = "terreno-syncdb";

/**
 * Persister that serializes the (mergeable) store to a single string, runs it
 * through an optional codec (for encryption at rest), and stores it in a
 * key-value backend. This is the foundation for encrypted persistence on any
 * platform that exposes a KV store.
 */
export const createKvPersister = ({
  store,
  storage,
  codec = identityCodec,
  key = DEFAULT_KEY,
}: {
  store: MergeableStore;
  storage: KeyValueStorage;
  codec?: PayloadCodec;
  key?: string;
}): SyncDbPersister => {
  let autoSaveListenerId: string | undefined;

  const save = async (): Promise<void> => {
    const serialized = JSON.stringify(store.getMergeableContent());
    const encoded = await codec.encode(serialized);
    await storage.setItem(key, encoded);
  };

  const load = async (): Promise<void> => {
    const encoded = await storage.getItem(key);
    if (!encoded) {
      return;
    }
    const serialized = await codec.decode(encoded);
    store.setMergeableContent(JSON.parse(serialized));
  };

  const startAutoSave = async (): Promise<void> => {
    await save();
    autoSaveListenerId = store.addDidFinishTransactionListener(() => {
      void save();
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
