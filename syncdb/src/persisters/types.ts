import type {MergeableStore} from "tinybase";
import type {AnyPersister} from "tinybase/persisters";

import type {KeyProvider} from "../crypto/types";

/**
 * Binds a TinyBase persister to a specific store + logical database name. The
 * returned persister must support MergeableStore content (TinyBase
 * `Persists.MergeableStoreOnly` or `Persists.StoreOrMergeableStore`) so CRDT
 * metadata survives the round trip.
 */
export type PersisterFactory = ({
  store,
  databaseName,
}: {
  store: MergeableStore;
  databaseName: string;
}) => AnyPersister;

/**
 * Options accepted by `createDefaultPersisterFactory` on every platform. Each
 * platform variant consumes the subset it needs and ignores the rest, keeping
 * the call site platform-agnostic.
 */
export interface DefaultPersisterFactoryConfig {
  /**
   * Encryption key provider (web only; encryption is default-on there).
   * Defaults to a device-local random key when omitted.
   */
  keyProvider?: KeyProvider;
  /** User id the encryption key is derived/scoped for (web only). */
  userId?: string;
  /** Invoked when persisted data cannot be decrypted (web only). */
  onDecryptFailure?: () => void;
  /** Trailing save debounce in ms; 0 disables debouncing (web only). */
  saveDebounceMs?: number;
  /** SQLite table name holding the JSON-serialized store (native only). */
  storeTableName?: string;
}
