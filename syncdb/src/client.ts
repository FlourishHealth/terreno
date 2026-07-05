import {createServerKeyProvider} from "./crypto/keyProviders";
import type {KeyProvider} from "./crypto/types";
import {listConflicts} from "./mutations/conflicts";
import {createOutbox, generateMutationId, type Outbox} from "./mutations/outbox";
import {resolveConflict as applyConflictResolution} from "./mutations/resolveConflict";
import {createDefaultPersisterFactory} from "./persisters/defaultPersisterFactory";
import type {PersisterFactory} from "./persisters/types";
import {createSyncStore, type SyncStore} from "./storage/store";
import {wipeLocalData} from "./storage/wipe";
import {bootstrapCollections} from "./sync/bootstrap";
import {getAllCursors} from "./sync/cursor";
import {applyDelta} from "./sync/deltaApplier";
import {createHttpChannel, type HttpChannel} from "./sync/httpChannel";
import {createReplayCoordinator, type ReplayCoordinator} from "./sync/replayCoordinator";
import {createSocketTransport} from "./sync/socketTransport";
import type {SendMutationResult, SyncTransport} from "./sync/transport";
import type {
  AuthProvider,
  ConflictResolutionStrategy,
  SyncDelta,
  SyncMutateRequest,
  SyncMutationOperation,
  SyncStatus,
} from "./types";

/** Periodic reconcile interval when not configured (5 minutes). */
export const DEFAULT_RECONCILE_INTERVAL_MS = 5 * 60_000;

/** Minimum interval between seq-jump-triggered reconciles per stream (30s). */
export const DEFAULT_SEQ_JUMP_RECONCILE_MIN_INTERVAL_MS = 30_000;

export interface SyncDbConfig {
  /** App/store name; used as the persisted database name. */
  name: string;
  /** Collections to sync (become local entity tables and subscriptions). */
  collections: string[];
  authProvider: AuthProvider;
  /** Server origin; required unless both transport and httpChannel are injected. */
  baseUrl?: string;
  /** Transport override (tests inject a fake; default is the socket transport). */
  transport?: SyncTransport;
  /** HTTP channel override (default is built from baseUrl when present). */
  httpChannel?: HttpChannel;
  /** Persister factory override (default is the platform default factory). */
  persisterFactory?: PersisterFactory;
  /** Encryption key provider forwarded to the default persister factory (web). */
  keyProvider?: KeyProvider;
  /** Periodic reconcile interval in ms; 0 disables (default 5 minutes). */
  reconcileIntervalMs?: number;
  /** Rate limit for seq-jump-triggered reconciles per stream (default 30s). */
  seqJumpReconcileMinIntervalMs?: number;
  /** Millisecond clock, injectable for deterministic rate-limit tests. */
  now?: () => number;
}

export interface MutateArgs {
  collection: string;
  operation: SyncMutationOperation;
  /** Target entity id; required for update/delete, generated for create. */
  id?: string;
  /** Fields to write (create/update). */
  data?: Record<string, unknown>;
}

export interface SyncDb {
  /** Local-first entity store (the UI's source of truth). */
  readonly store: SyncStore;
  /** Durable mutation outbox. */
  readonly outbox: Outbox;
  /**
   * Resolve the user, run the wipe-on-user-change check, start persistence,
   * connect the transport, subscribe collections, and start the periodic
   * reconcile timer. Resolves even when the transport cannot connect
   * (local-first: the app works offline and syncs when connectivity returns).
   */
  start: () => Promise<void>;
  /** Disconnect, stop persistence, clear timers, and remove listeners. */
  stop: () => Promise<void>;
  /**
   * Apply a mutation optimistically to the local store, enqueue it in the
   * outbox, and kick off a fire-and-forget replay. Returns the generated
   * mutation id and the entity id (generated for creates).
   */
  mutate: (args: MutateArgs) => {mutationId: string; id: string};
  /** Snapshot-from-cursor catch-up for every collection (no-op without HTTP). */
  reconcile: () => Promise<void>;
  /** Drain queued mutations for the current user now. */
  replayOutbox: () => Promise<void>;
  /** Resolve a recorded conflict with the given strategy. */
  resolveConflict: (args: {mutationId: string; strategy: ConflictResolutionStrategy}) => void;
  /** Aggregate sync state for status UI. */
  getSyncStatus: () => SyncStatus;
  /**
   * Subscribe to non-store status inputs (connectivity, syncing activity).
   * `getSyncStatus()` is a snapshot; store-backed inputs (outbox, conflicts,
   * cursors) already emit through TinyBase listeners on `store.raw`, but
   * `isOnline`/`isSyncing` live outside the store — this hook covers them.
   * Returns an unsubscribe function.
   */
  onStatusChange: (callback: () => void) => () => void;
}

/**
 * Assemble the full local-first client: store + outbox + persister + transport
 * + HTTP channel + replay coordinator + reconcile heuristics.
 *
 * Reconcile triggers: transport (re)connect, rate-limited seq-jump hints from
 * deltas, and a periodic timer. Replay triggers: (re)connect, auth changes,
 * and every `mutate()`.
 */
export const createSyncDb = (config: SyncDbConfig): SyncDb => {
  if (!config.transport && !config.baseUrl) {
    throw new Error("createSyncDb requires a transport or a baseUrl");
  }

  const now = config.now ?? ((): number => Date.now());
  const transport =
    config.transport ??
    createSocketTransport({
      authProvider: config.authProvider,
      // biome-ignore lint/style/noNonNullAssertion: guarded above — no transport implies baseUrl.
      baseUrl: config.baseUrl!,
    });
  const httpChannel =
    config.httpChannel ??
    (config.baseUrl
      ? createHttpChannel({authProvider: config.authProvider, baseUrl: config.baseUrl})
      : undefined);

  const store = createSyncStore({collections: config.collections});
  const outbox = createOutbox({store});

  let currentUserId: string | undefined;
  let persister: ReturnType<PersisterFactory> | undefined;
  let connected = false;
  let syncingCount = 0;
  let reconcileTimer: ReturnType<typeof setInterval> | undefined;
  let unsubscribers: (() => void)[] = [];
  const lastSeqJumpReconcileAt = new Map<string, number>();
  const statusListeners = new Set<() => void>();

  const notifyStatusChange = (): void => {
    for (const listener of statusListeners) {
      listener();
    }
  };

  const setConnected = (value: boolean): void => {
    if (connected === value) {
      return;
    }
    connected = value;
    notifyStatusChange();
  };

  const addSyncing = (delta: number): void => {
    const wasSyncing = syncingCount > 0;
    syncingCount += delta;
    if (wasSyncing !== syncingCount > 0) {
      notifyStatusChange();
    }
  };

  // Prefer the socket for mutations; fall back to HTTP while disconnected.
  const sendMutation = async (request: SyncMutateRequest): Promise<SendMutationResult> => {
    if (connected || !httpChannel) {
      return transport.sendMutation(request);
    }
    return httpChannel.sendMutation(request);
  };

  const coordinator: ReplayCoordinator = createReplayCoordinator({
    now,
    outbox,
    sendMutation,
    store,
  });

  const reconcile = async (): Promise<void> => {
    if (!httpChannel) {
      return;
    }
    addSyncing(1);
    try {
      await bootstrapCollections({channel: httpChannel, collections: config.collections, store});
    } finally {
      addSyncing(-1);
    }
  };

  const replayOutbox = async (): Promise<void> => {
    if (!currentUserId) {
      return;
    }
    addSyncing(1);
    try {
      await coordinator.replay({userId: currentUserId});
    } finally {
      addSyncing(-1);
    }
  };

  const warn = (message: string): ((error: unknown) => void) => {
    return (error: unknown): void => {
      console.warn(`[syncdb] ${message}`, error);
    };
  };

  const createAndStartPersister = async (userId: string): Promise<void> => {
    // Default key provider is SERVER-DERIVED (HKDF over GET /sync/key material) so the
    // server can rotate/revoke; pass keyProvider: createLocalKeyProvider() for a purely
    // device-local key with no server-side copy of the material.
    const keyProvider =
      config.keyProvider ??
      (httpChannel
        ? createServerKeyProvider({
            appName: config.name,
            fetchKeyMaterial: httpChannel.fetchKeyMaterial,
          })
        : undefined);
    const factory = config.persisterFactory ?? createDefaultPersisterFactory({keyProvider, userId});
    persister = factory({databaseName: config.name, store: store.raw});
    await persister.startAutoLoad();
    await persister.startAutoSave();
  };

  /**
   * Wipe-on-user-change: when the persisted `lastUserId` differs from the
   * authenticated user, destroy all local data (entities, outbox, cursors,
   * conflicts, persisted databases) and start fresh for the new user.
   */
  const runUserCheck = async (userId: string): Promise<void> => {
    const lastUserId = store.getLastUserId();
    if (lastUserId !== undefined && lastUserId !== userId) {
      await wipeLocalData({databaseNames: [config.name], persister, store});
      lastSeqJumpReconcileAt.clear();
      await createAndStartPersister(userId);
    }
    store.setLastUserId({userId});
    currentUserId = userId;
  };

  const handleDelta = (delta: SyncDelta): void => {
    const {seqJump} = applyDelta({delta, store});
    if (!seqJump) {
      return;
    }
    // Seq jumps are hints, not proofs (permission-filtered deltas legitimately
    // skip seqs) — rate-limit the reconcile per stream.
    const minInterval =
      config.seqJumpReconcileMinIntervalMs ?? DEFAULT_SEQ_JUMP_RECONCILE_MIN_INTERVAL_MS;
    const last = lastSeqJumpReconcileAt.get(delta.stream);
    if (last !== undefined && now() - last < minInterval) {
      return;
    }
    lastSeqJumpReconcileAt.set(delta.stream, now());
    void reconcile().catch(warn("seq-jump reconcile failed"));
  };

  const handleStatusChange = ({connected: isConnected}: {connected: boolean}): void => {
    setConnected(isConnected);
    if (!isConnected) {
      return;
    }
    void reconcile().catch(warn("reconnect reconcile failed"));
    void replayOutbox().catch(warn("reconnect replay failed"));
  };

  const handleAuthChange = (): void => {
    void (async (): Promise<void> => {
      const userId = await config.authProvider.getUserId();
      if (!userId) {
        currentUserId = undefined;
        return;
      }
      if (userId !== currentUserId) {
        await runUserCheck(userId);
        void reconcile().catch(warn("post-auth reconcile failed"));
      }
      void replayOutbox().catch(warn("post-auth replay failed"));
    })().catch(warn("auth change handling failed"));
  };

  const start = async (): Promise<void> => {
    const userId = await config.authProvider.getUserId();
    if (!userId) {
      throw new Error("createSyncDb.start() requires an authenticated user");
    }
    await createAndStartPersister(userId);
    await runUserCheck(userId);

    unsubscribers.push(transport.onDelta(handleDelta));
    unsubscribers.push(transport.onStatusChange(handleStatusChange));
    unsubscribers.push(config.authProvider.onAuthChange(handleAuthChange));

    try {
      await transport.connect();
    } catch (error) {
      // Local-first: start succeeds offline; reconnection/status events pick
      // up syncing when connectivity returns.
      warn("transport connect failed; starting offline")(error);
    }
    transport.subscribe(config.collections);

    const interval = config.reconcileIntervalMs ?? DEFAULT_RECONCILE_INTERVAL_MS;
    if (interval > 0) {
      reconcileTimer = setInterval(() => {
        void reconcile().catch(warn("periodic reconcile failed"));
        void replayOutbox().catch(warn("periodic replay failed"));
      }, interval);
    }
  };

  const stop = async (): Promise<void> => {
    if (reconcileTimer !== undefined) {
      clearInterval(reconcileTimer);
      reconcileTimer = undefined;
    }
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
    unsubscribers = [];
    transport.disconnect();
    setConnected(false);
    if (persister) {
      // Flush any pending autosave so a clean stop never loses local writes.
      await persister.save();
      await persister.destroy();
      persister = undefined;
    }
    currentUserId = undefined;
  };

  const mutate = ({
    collection,
    operation,
    id,
    data,
  }: MutateArgs): {
    mutationId: string;
    id: string;
  } => {
    if (!currentUserId) {
      throw new Error("mutate() requires start() to have resolved an authenticated user");
    }
    if (operation !== "create" && !id) {
      throw new Error(`mutate() requires an id for ${operation}`);
    }
    const mutationId = generateMutationId();
    const entityId = id ?? generateMutationId();
    const existing = store.getEntity<Record<string, unknown> | null>({collection, id: entityId});

    if (operation === "delete") {
      store.softDeleteEntity({collection, id: entityId});
      store.upsertEntity({
        collection,
        data: existing?.data ?? null,
        deleted: true,
        id: entityId,
        pendingMutationId: mutationId,
      });
    } else {
      const mergedData =
        operation === "update" && existing && typeof existing.data === "object" && existing.data
          ? {...existing.data, ...data}
          : (data ?? {});
      store.upsertEntity({
        collection,
        data: mergedData,
        id: entityId,
        pendingMutationId: mutationId,
      });
    }

    outbox.enqueue({
      args: data ?? {},
      baseVersion: existing?.seq,
      collection,
      entityId,
      mutationId,
      operation,
      userId: currentUserId,
    });
    void replayOutbox().catch(warn("post-mutate replay failed"));
    return {id: entityId, mutationId};
  };

  const resolveConflict = ({
    mutationId,
    strategy,
  }: {
    mutationId: string;
    strategy: ConflictResolutionStrategy;
  }): void => {
    applyConflictResolution({mutationId, outbox, store, strategy});
    // keepMine re-enqueues the mutation with a fresh baseVersion — drain it now
    // rather than waiting for the next mutate/reconnect/periodic trigger.
    void replayOutbox().catch(warn("post-resolve replay failed"));
  };

  const getSyncStatus = (): SyncStatus => ({
    conflictCount: listConflicts({store}).length,
    isOnline: connected,
    isSyncing: syncingCount > 0,
    queuedCount: currentUserId ? outbox.listQueued({userId: currentUserId}).length : 0,
    streams: getAllCursors({store}),
  });

  const onStatusChange = (callback: () => void): (() => void) => {
    statusListeners.add(callback);
    return () => {
      statusListeners.delete(callback);
    };
  };

  return {
    getSyncStatus,
    mutate,
    onStatusChange,
    outbox,
    reconcile,
    replayOutbox,
    resolveConflict,
    start,
    stop,
    store,
  };
};
