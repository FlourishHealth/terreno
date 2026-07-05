import {createKeyProviderCodec, createLocalKeyProvider} from "../crypto/keyProviders";
import {createEncryptedIndexedDbPersister} from "./encryptedIndexedDbPersister";
import type {DefaultPersisterFactoryConfig, PersisterFactory} from "./types";

/** Key scope used when the caller has not (yet) supplied a user id. */
const DEFAULT_KEY_SCOPE_USER_ID = "local";

/**
 * Web default persister: the encrypted IndexedDB persister with encryption
 * default-on. Without explicit config the key is a device-local random
 * non-extractable key; production apps pass a `createServerKeyProvider`-backed
 * `keyProvider` + `userId` so the key derives from server key material.
 */
export const createDefaultPersisterFactory = (
  config: DefaultPersisterFactoryConfig = {}
): PersisterFactory => {
  const keyProvider = config.keyProvider ?? createLocalKeyProvider();
  const userId = config.userId ?? DEFAULT_KEY_SCOPE_USER_ID;
  return ({store, databaseName}) =>
    createEncryptedIndexedDbPersister({
      codec: createKeyProviderCodec({keyProvider, userId}),
      databaseName,
      onDecryptFailure: config.onDecryptFailure,
      saveDebounceMs: config.saveDebounceMs,
      store,
    });
};
