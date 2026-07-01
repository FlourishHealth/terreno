import type {MergeableStore} from "tinybase";

/**
 * Minimal persistence contract the syncdb client depends on. It is intentionally
 * a subset of TinyBase's `Persister` so platform persisters (expo-sqlite on
 * native, localStorage on web) and the in-memory persister can all satisfy it.
 */
export interface SyncDbPersister {
  /** Load persisted content into the store (no-op if nothing persisted yet). */
  load(): Promise<void>;
  /** Persist the current store content immediately. */
  save(): Promise<void>;
  /** Persist now and keep persisting on every subsequent store change. */
  startAutoSave(): Promise<void>;
  /** Stop the auto-save subscription. */
  stopAutoSave(): void;
  /** Release any listeners/resources held by the persister. */
  destroy(): void;
}

/** Factory that binds a persister to a specific store instance. */
export type SyncDbPersisterFactory = (
  store: MergeableStore
) => SyncDbPersister | Promise<SyncDbPersister>;

/** Options accepted by the platform default persister factories. */
export interface DefaultPersisterOptions {
  /** SQLite filename (native) or localStorage key (web). */
  databaseName?: string;
  /** Table name used for the JSON-serialized store (native SQLite only). */
  storeTableName?: string;
}

/**
 * Structural subset of a TinyBase `Persister` consumed by {@link adaptPersister}.
 * Declared locally so the adapter does not couple to TinyBase's exact return
 * types (which return the persister for chaining).
 */
export interface RawPersister {
  load: () => Promise<unknown>;
  save: () => Promise<unknown>;
  startAutoSave: () => Promise<unknown>;
  stopAutoSave: () => unknown;
  destroy: () => unknown;
}
