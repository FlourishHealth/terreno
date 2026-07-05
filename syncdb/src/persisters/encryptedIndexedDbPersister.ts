import type {MergeableContent, MergeableStore} from "tinybase";
import {createCustomPersister, type Persister, Persists} from "tinybase/persisters";

import type {PayloadCodec} from "../crypto/types";
import {idbGet, idbSet} from "../storage/idb";

/** Object-store record key holding the single encrypted blob. */
const RECORD_KEY = "content";

/** Default trailing debounce applied to saves (autosave can fire per transaction). */
const DEFAULT_SAVE_DEBOUNCE_MS = 500;

interface PendingSave {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: unknown) => void;
}

/**
 * Web persister storing the whole MergeableStore as ONE encrypted binary blob
 * in IndexedDB (database per `databaseName`, single object store, single
 * record). The plaintext JSON only ever exists in memory: serialize → encode
 * (AES-GCM) → put blob. Corrupt or undecryptable data is treated as a fresh
 * store — `onDecryptFailure` fires so the caller can wipe and re-bootstrap.
 *
 * Saves are debounced with a trailing edge (default 500ms) since TinyBase's
 * autosave fires on every transaction: each write waits out the debounce
 * window, and follow-up saves whose serialized content matches the last
 * written snapshot are skipped, coalescing a burst of transactions into a
 * single encode + IndexedDB put.
 */
export const createEncryptedIndexedDbPersister = ({
  store,
  databaseName,
  codec,
  onDecryptFailure,
  saveDebounceMs = DEFAULT_SAVE_DEBOUNCE_MS,
}: {
  store: MergeableStore;
  databaseName: string;
  codec: PayloadCodec;
  onDecryptFailure?: () => void;
  saveDebounceMs?: number;
}): Persister<Persists.MergeableStoreOnly> => {
  let lastWrittenJson: string | undefined;
  let pendingSave: PendingSave | undefined;
  // Serializes writes so a slow encode/put can never land after (and clobber)
  // a newer snapshot's write.
  let writeChain: Promise<void> = Promise.resolve();

  const writeJson = (json: string): Promise<void> => {
    const write = writeChain.then(async () => {
      const payload = await codec.encode(json);
      await idbSet({databaseName, key: RECORD_KEY, value: payload});
      lastWrittenJson = json;
    });
    // Keep the chain alive after a failed write; the failure still propagates
    // to the caller through `write`.
    writeChain = write.catch(() => {});
    return write;
  };

  const flushPendingSave = async (): Promise<void> => {
    const pending = pendingSave;
    pendingSave = undefined;
    if (!pending) {
      return;
    }
    try {
      // Trailing edge: snapshot the store at flush time so a burst of
      // transactions during the debounce window lands as one fresh write.
      await writeJson(JSON.stringify(store.getMergeableContent()));
      pending.resolve();
    } catch (error) {
      pending.reject(error);
    }
  };

  const getPersisted = async (): Promise<MergeableContent | undefined> => {
    const payload = await idbGet<unknown>({databaseName, key: RECORD_KEY});
    if (payload === undefined) {
      return undefined;
    }
    try {
      if (!(payload instanceof Uint8Array)) {
        throw new Error("Persisted record is not a binary payload");
      }
      return JSON.parse(await codec.decode(payload)) as MergeableContent;
    } catch (_error) {
      onDecryptFailure?.();
      return undefined;
    }
  };

  const setPersisted = async (getContent: () => MergeableContent): Promise<void> => {
    const json = JSON.stringify(getContent());
    if (saveDebounceMs <= 0) {
      await writeJson(json);
      return;
    }
    // TinyBase serializes setPersisted calls, so per-transaction autosaves
    // arrive one at a time; skipping saves whose content already matches the
    // last written snapshot is what coalesces a rapid burst into one write.
    if (json === lastWrittenJson && !pendingSave) {
      return;
    }
    if (!pendingSave) {
      let resolvePending!: () => void;
      let rejectPending!: (error: unknown) => void;
      const promise = new Promise<void>((res, rej) => {
        resolvePending = res;
        rejectPending = rej;
      });
      pendingSave = {promise, reject: rejectPending, resolve: resolvePending};
      setTimeout(() => {
        void flushPendingSave();
      }, saveDebounceMs);
    }
    await pendingSave.promise;
  };

  return createCustomPersister<number, Persists.MergeableStoreOnly>(
    store,
    getPersisted,
    setPersisted,
    // Nothing mutates the blob outside this persister, so no change listener;
    // a token handle keeps the add/del listener lifecycle symmetric.
    (): number => 1,
    (_listenerHandle: number): void => {},
    undefined,
    Persists.MergeableStoreOnly
  );
};
