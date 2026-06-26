import {type ConflictStore, createConflictStore} from "./mutations/conflicts";
import {createOutbox, type Outbox} from "./mutations/outbox";
import type {ConflictStrategy} from "./mutations/resolveConflict";
import {type ConflictResolver, createConflictResolver} from "./mutations/resolveConflict";
import {createDefaultPersisterFactory} from "./persisters/defaultPersisterFactory";
import type {SyncDbPersister} from "./persisters/types";
import {createSyncStore, type SyncStore} from "./storage/store";
import {SYNC_TABLES} from "./storage/types";
import {createDeltaApplier, type DeltaApplier} from "./sync/deltaApplier";
import {createReplayCoordinator, type ReplayCoordinator} from "./sync/replayCoordinator";
import type {SyncDbClientConfig, SyncStatus} from "./types";

export interface SyncDbClient {
  /** Typed entity store (local-first source of truth). */
  readonly store: SyncStore;
  /** Durable mutation outbox. */
  readonly outbox: Outbox;
  /** Unresolved-conflict store. */
  readonly conflicts: ConflictStore;
  /** Cursor-aware delta applier (for advanced/manual use). */
  readonly deltaApplier: DeltaApplier;
  /** Initialize persistence: load persisted content and (optionally) auto-save. */
  start(): Promise<void>;
  /** Force a persistence flush. */
  save(): Promise<void>;
  /** Connect the configured transport and begin replay/delta sync. */
  connectSync(): Promise<void>;
  /** Disconnect the transport and stop sync. */
  disconnectSync(): void;
  /** Replay queued mutations now (no-op if not connected). */
  replayOutbox(): void;
  /** Resolve a conflict with the given strategy. */
  resolveConflict(args: {conflictId: string; strategy: ConflictStrategy}): void;
  /** Current aggregate sync status. */
  getSyncStatus(): SyncStatus;
  /** Update perceived network connectivity (driven by the transport layer). */
  setOnline(args: {isOnline: boolean}): void;
  /** Update whether the outbox is actively replaying. */
  setSyncing(args: {isSyncing: boolean}): void;
  /** Update whether replay is paused on auth refresh failure. */
  setAuthBlocked(args: {authBlocked: boolean}): void;
  /** Subscribe to status changes (returns an unsubscribe function). */
  addStatusListener(listener: (status: SyncStatus) => void): () => void;
  /** Stop auto-save, disconnect sync, and release resources. */
  destroy(): Promise<void>;
}

interface MutableStatus {
  isOnline: boolean;
  isSyncing: boolean;
  authBlocked: boolean;
}

/**
 * Create a local-first sync client: a schema-bound TinyBase MergeableStore, a
 * durable outbox, a conflict store, a platform persister, and (when a transport
 * is configured) websocket-style delta sync with ack/nack-driven outbox replay.
 * Reads/writes are local-first; the server reconciles asynchronously.
 */
export const createSyncDbClient = (config: SyncDbClientConfig = {}): SyncDbClient => {
  const store = createSyncStore({storeId: config.storeId});
  const outbox = createOutbox({store: store.raw});
  const conflicts = createConflictStore({store: store.raw});
  const deltaApplier = createDeltaApplier({store});
  // With a transport configured, start offline until connectSync() succeeds;
  // without one, assume connectivity (optimistic, transport-less consumers).
  const status: MutableStatus = {
    authBlocked: false,
    isOnline: !config.transport,
    isSyncing: false,
  };
  const statusListeners = new Set<(status: SyncStatus) => void>();

  let persister: SyncDbPersister | undefined;
  let startPromise: Promise<void> | undefined;
  let replayCoordinator: ReplayCoordinator | undefined;
  let transportUnsubs: Array<() => void> = [];

  const conflictResolver: ConflictResolver = createConflictResolver({conflicts, outbox, store});

  const getSyncStatus = (): SyncStatus => ({
    authBlocked: status.authBlocked,
    conflictCount: conflicts.count(),
    isOnline: status.isOnline,
    isSyncing: status.isSyncing,
    // Pending = not-yet-acknowledged work (queued + in flight); conflicted and
    // failed mutations are surfaced separately, not as "queued".
    queuedCount: outbox.count({status: "queued"}) + outbox.count({status: "inFlight"}),
  });

  const notifyStatus = (): void => {
    const snapshot = getSyncStatus();
    for (const listener of statusListeners) {
      listener(snapshot);
    }
  };

  // Surface outbox/conflict count changes (enqueue, ack, conflict capture,
  // dismiss) to status subscribers, not just the explicit flag setters.
  const internalListenerIds = [
    store.raw.addTableListener(SYNC_TABLES.outbox, notifyStatus),
    store.raw.addTableListener(SYNC_TABLES.conflicts, notifyStatus),
  ];

  const setOnline = ({isOnline}: {isOnline: boolean}): void => {
    status.isOnline = isOnline;
    notifyStatus();
  };

  const setSyncing = ({isSyncing}: {isSyncing: boolean}): void => {
    status.isSyncing = isSyncing;
    notifyStatus();
  };

  const setAuthBlocked = ({authBlocked}: {authBlocked: boolean}): void => {
    status.authBlocked = authBlocked;
    notifyStatus();
  };

  const updateSyncing = (): void => {
    setSyncing({isSyncing: outbox.count({status: "inFlight"}) > 0});
  };

  const initialize = async (): Promise<void> => {
    const factory =
      config.persisterFactory ?? createDefaultPersisterFactory({databaseName: config.databaseName});
    persister = await factory(store.raw);
    await persister.load();
    if (config.autoSave !== false) {
      await persister.startAutoSave();
    }
  };

  // Cache the in-flight promise so concurrent start() calls share one
  // initialization rather than creating duplicate persisters/listeners. A
  // failed init clears the cache so a later start() can retry.
  const start = async (): Promise<void> => {
    if (!startPromise) {
      startPromise = initialize().catch((error) => {
        startPromise = undefined;
        throw error;
      });
    }
    return startPromise;
  };

  const requeueInFlight = (): void => {
    for (const mutation of outbox.list({status: "inFlight"})) {
      outbox.markQueued({mutationId: mutation.mutationId});
    }
  };

  const save = async (): Promise<void> => {
    if (!persister) {
      throw new Error("SyncDbClient.save() called before start()");
    }
    await persister.save();
  };

  const replayOutbox = (): void => {
    if (!replayCoordinator) {
      return;
    }
    // Replay is paused while auth is blocked; it resumes on reconnect (which
    // clears authBlocked) so mutations are not fired against an expired session.
    if (status.authBlocked) {
      return;
    }
    replayCoordinator.replay();
    updateSyncing();
  };

  const teardownTransport = (): void => {
    for (const unsubscribe of transportUnsubs) {
      unsubscribe();
    }
    transportUnsubs = [];
    replayCoordinator = undefined;
  };

  const connectSync = async (): Promise<void> => {
    const transport = config.transport;
    if (!transport) {
      throw new Error("SyncDbClient.connectSync() requires a configured transport");
    }
    if (replayCoordinator) {
      return;
    }

    replayCoordinator = createReplayCoordinator({
      conflicts,
      onAuthBlocked: (authBlocked) => setAuthBlocked({authBlocked}),
      outbox,
      store,
      transport,
    });

    transportUnsubs.push(replayCoordinator.start());
    transportUnsubs.push(
      transport.onEvent((event) => {
        if (event.type === "sync:delta") {
          deltaApplier.apply(event);
        }
        updateSyncing();
      })
    );
    transportUnsubs.push(
      transport.onStatus((connectionStatus) => {
        const isOnline = connectionStatus === "connected";
        setOnline({isOnline});
        if (isOnline) {
          setAuthBlocked({authBlocked: false});
          replayOutbox();
        }
      })
    );

    try {
      await transport.connect();
    } catch (error) {
      // Roll back partial wiring so a later connectSync() can retry cleanly.
      teardownTransport();
      throw error;
    }
  };

  const disconnectSync = (): void => {
    teardownTransport();
    config.transport?.disconnect();
    // Return any in-flight mutations to the queue so they re-send on reconnect
    // rather than being stranded (and keeping isSyncing stuck true).
    requeueInFlight();
    setOnline({isOnline: false});
    setSyncing({isSyncing: false});
  };

  const resolveConflict = (args: {conflictId: string; strategy: ConflictStrategy}): void => {
    conflictResolver.resolve(args);
    // keepMine requeues the mutation; replay it now so the kept-local change is
    // not stranded until an unrelated replay fires.
    replayOutbox();
    notifyStatus();
  };

  const addStatusListener = (listener: (status: SyncStatus) => void): (() => void) => {
    statusListeners.add(listener);
    return () => {
      statusListeners.delete(listener);
    };
  };

  const destroy = async (): Promise<void> => {
    // Await any in-flight initialization so we don't tear down a persister that
    // is still being created (which would leave a dangling auto-save listener).
    const pendingStart = startPromise;
    if (pendingStart !== undefined) {
      try {
        await pendingStart;
      } catch {
        // Ignore init failure during teardown.
      }
    }
    disconnectSync();
    if (persister) {
      persister.stopAutoSave();
      persister.destroy();
      persister = undefined;
    }
    for (const listenerId of internalListenerIds) {
      store.raw.delListener(listenerId);
    }
    statusListeners.clear();
    startPromise = undefined;
  };

  return {
    addStatusListener,
    conflicts,
    connectSync,
    deltaApplier,
    destroy,
    disconnectSync,
    getSyncStatus,
    outbox,
    replayOutbox,
    resolveConflict,
    save,
    setAuthBlocked,
    setOnline,
    setSyncing,
    start,
    store,
  };
};
