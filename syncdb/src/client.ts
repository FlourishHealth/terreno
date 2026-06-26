import {createOutbox, type Outbox} from "./mutations/outbox";
import {createDefaultPersisterFactory} from "./persisters/defaultPersisterFactory";
import type {SyncDbPersister} from "./persisters/types";
import {createSyncStore, type SyncStore} from "./storage/store";
import {SYNC_TABLES} from "./storage/types";
import type {SyncDbClientConfig, SyncStatus} from "./types";

export interface SyncDbClient {
  /** Typed entity store (local-first source of truth). */
  readonly store: SyncStore;
  /** Durable mutation outbox. */
  readonly outbox: Outbox;
  /** Initialize persistence: load persisted content and (optionally) auto-save. */
  start(): Promise<void>;
  /** Force a persistence flush. */
  save(): Promise<void>;
  /** Current aggregate sync status. */
  getSyncStatus(): SyncStatus;
  /** Update perceived network connectivity (driven by the transport layer). */
  setOnline(args: {isOnline: boolean}): void;
  /** Update whether the outbox is actively replaying. */
  setSyncing(args: {isSyncing: boolean}): void;
  /** Update whether replay is paused on auth refresh failure. */
  setAuthBlocked(args: {authBlocked: boolean}): void;
  /** Stop auto-save and release persister resources. */
  destroy(): Promise<void>;
}

interface MutableStatus {
  isOnline: boolean;
  isSyncing: boolean;
  authBlocked: boolean;
}

/**
 * Create a local-first sync client: a schema-bound TinyBase MergeableStore, a
 * durable outbox, and a platform persister. Reads/writes are local-first; the
 * websocket delta-sync transport and conflict reconciliation land in later
 * phases and will drive the network/syncing/auth-blocked status flags.
 */
export const createSyncDbClient = (config: SyncDbClientConfig = {}): SyncDbClient => {
  const store = createSyncStore({storeId: config.storeId});
  const outbox = createOutbox({store: store.raw});
  const status: MutableStatus = {authBlocked: false, isOnline: true, isSyncing: false};

  let persister: SyncDbPersister | undefined;
  let started = false;

  const start = async (): Promise<void> => {
    if (started) {
      return;
    }
    const factory =
      config.persisterFactory ?? createDefaultPersisterFactory({databaseName: config.databaseName});
    persister = await factory(store.raw);
    await persister.load();
    if (config.autoSave !== false) {
      await persister.startAutoSave();
    }
    started = true;
  };

  const save = async (): Promise<void> => {
    if (!persister) {
      throw new Error("SyncDbClient.save() called before start()");
    }
    await persister.save();
  };

  const getSyncStatus = (): SyncStatus => ({
    authBlocked: status.authBlocked,
    conflictCount: store.raw.getRowIds(SYNC_TABLES.conflicts).length,
    isOnline: status.isOnline,
    isSyncing: status.isSyncing,
    queuedCount: outbox.count(),
  });

  const setOnline = ({isOnline}: {isOnline: boolean}): void => {
    status.isOnline = isOnline;
  };

  const setSyncing = ({isSyncing}: {isSyncing: boolean}): void => {
    status.isSyncing = isSyncing;
  };

  const setAuthBlocked = ({authBlocked}: {authBlocked: boolean}): void => {
    status.authBlocked = authBlocked;
  };

  const destroy = async (): Promise<void> => {
    if (persister) {
      persister.stopAutoSave();
      persister.destroy();
      persister = undefined;
    }
    started = false;
  };

  return {
    destroy,
    getSyncStatus,
    outbox,
    save,
    setAuthBlocked,
    setOnline,
    setSyncing,
    start,
    store,
  };
};
