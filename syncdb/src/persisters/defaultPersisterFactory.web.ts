import type {AnyPersister} from "tinybase/persisters";

import {createKeyProviderCodec, createLocalKeyProvider} from "../crypto/keyProviders";
import {createEncryptedIndexedDbPersister} from "./encryptedIndexedDbPersister";
import {memoryPersisterFactory} from "./memoryPersister";
import type {DefaultPersisterFactoryConfig, PersisterFactory} from "./types";

/** Key scope used when the caller has not (yet) supplied a user id. */
const DEFAULT_KEY_SCOPE_USER_ID = "local";

/**
 * E3(c): true once the one-time "no IndexedDB, falling back to memory
 * persistence" warning has fired for this session — module-level so the
 * warning is emitted at most once per page load even across multiple
 * `createSyncDb` instances (e.g. tests, or an app with more than one store).
 */
let hasWarnedNoIndexedDb = false;

/**
 * Web default persister: the encrypted IndexedDB persister with encryption
 * default-on. Without explicit config the key is a device-local random
 * non-extractable key; production apps pass a `createServerKeyProvider`-backed
 * `keyProvider` + `userId` so the key derives from server key material.
 *
 * E3(c): when `globalThis.indexedDB` is unavailable (private-browsing modes
 * that disable it, a locked-down embedded webview), falls back to the
 * in-memory persister rather than throwing — local-first apps should still
 * start, just without durable persistence for this session — and warns once.
 * The returned persister carries a `persistenceMode` marker
 * (`"durable" | "memory"`) so callers (see `client.ts`) can surface the
 * degraded mode on `SyncStatus` instead of it being silently invisible.
 */
export const createDefaultPersisterFactory = (
  config: DefaultPersisterFactoryConfig = {}
): PersisterFactory => {
  const keyProvider = config.keyProvider ?? createLocalKeyProvider();
  const userId = config.userId ?? DEFAULT_KEY_SCOPE_USER_ID;
  return ({store, databaseName, hooks}) => {
    // Call-time `hooks` (see `PersisterFactory`) and config-time callbacks
    // are the same closures in the real client.ts flow; call-time wins when
    // both are present so a caller building this factory directly (tests, or
    // a host app not going through createSyncDb's config-time wiring) can
    // rely on `hooks` alone.
    const onDecryptFailure = hooks?.onDecryptFailure ?? config.onDecryptFailure;
    const onLoadFailure = hooks?.onLoadFailure ?? config.onLoadFailure;
    const onSaveFailure = hooks?.onSaveFailure ?? config.onSaveFailure;
    if (typeof globalThis.indexedDB === "undefined") {
      if (!hasWarnedNoIndexedDb) {
        hasWarnedNoIndexedDb = true;
        console.warn(
          "[syncdb] IndexedDB is unavailable in this environment; falling back to in-memory persistence (data will not survive a reload)"
        );
      }
      const memoryPersister = memoryPersisterFactory({databaseName, store});
      // Spreading a frozen Persister into a plain object is safe (copies
      // enumerable own properties) and lets callers detect the fallback via
      // `persistenceMode` without needing an isSynchronizer-style branch at
      // every call site.
      return {...memoryPersister, persistenceMode: "memory"} as AnyPersister & {
        persistenceMode: "memory";
      };
    }
    const persister = createEncryptedIndexedDbPersister({
      codec: createKeyProviderCodec({keyProvider, userId}),
      databaseName,
      idbGetImpl: config.idbGetImpl,
      idbSetImpl: config.idbSetImpl,
      onDecryptFailure,
      onLoadFailure,
      onSaveFailure,
      saveDebounceMs: config.saveDebounceMs,
      store,
    });
    return {...persister, persistenceMode: "durable"} as AnyPersister & {
      persistenceMode: "durable";
    };
  };
};
