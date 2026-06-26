import type {SyncDbPersisterFactory} from "./persisters/types";

/** Aggregate, UI-facing sync state surfaced by the client. */
export interface SyncStatus {
  /** Whether the transport believes the device is online. */
  isOnline: boolean;
  /** Whether the outbox is actively replaying to the server. */
  isSyncing: boolean;
  /** Whether replay is paused because auth refresh failed. */
  authBlocked: boolean;
  /** Number of mutations still pending in the outbox. */
  queuedCount: number;
  /** Number of unresolved conflicts. */
  conflictCount: number;
}

/** Configuration for {@link createSyncDbClient}. */
export interface SyncDbClientConfig {
  /** SQLite filename (native) / localStorage key (web) for persistence. */
  databaseName?: string;
  /** Optional deterministic store id (mainly for tests/HLC determinism). */
  storeId?: string;
  /**
   * Override the persister. Defaults to the platform persister
   * (expo-sqlite on native, localStorage on web, in-memory under Node/SSR).
   */
  persisterFactory?: SyncDbPersisterFactory;
  /** Persist on every change after start (default: true). */
  autoSave?: boolean;
}
