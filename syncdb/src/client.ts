import {createServerKeyProvider} from "./crypto/keyProviders";
import type {KeyProvider} from "./crypto/types";
import {resolveDebugLog, type SyncDebugLog, type SyncDebugLogOptions} from "./debug/debugLog";
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
  /**
   * Enable the in-memory debug event log (patches, mutations, acks/nacks,
   * conflicts, reconcile/replay, connectivity). `true` uses defaults; pass
   * options to size the buffer. Off by default — zero overhead when disabled.
   * Powers the sync debugger UI and the future MCP introspection surface.
   */
  debug?: boolean | SyncDebugLogOptions;
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
   * Simulate a network outage: disconnect the transport and pause replay,
   * reconcile, and the periodic timer. Unlike stop(), the resolved user and
   * persistence stay alive, so mutations keep applying locally and queueing
   * in the durable outbox. `getSyncStatus().isOnline` reports false until
   * goOnline() (or a stop()/start() cycle) restores connectivity.
   */
  goOffline: () => void;
  /**
   * End a simulated outage: reconnect the transport, resubscribe, and restart
   * the periodic timer. The reconnect status event triggers a reconcile and
   * replays the queued outbox.
   */
  goOnline: () => Promise<void>;
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
  /**
   * In-memory debug event log when `config.debug` is enabled; otherwise
   * undefined. Its `snapshot()` is a plain serializable object suitable for
   * returning directly over MCP.
   */
  readonly debug?: SyncDebugLog;
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
  const debugLog = resolveDebugLog(config.debug);

  let currentUserId: string | undefined;
  let persister: ReturnType<PersisterFactory> | undefined;
  let connected = false;
  let simulatedOffline = false;
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
    debugLog?.record({
      direction: "system",
      label: value ? "transport connected" : "transport disconnected",
      type: value ? "connect" : "disconnect",
    });
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
    debug: debugLog,
    now,
    outbox,
    sendMutation,
    store,
  });

  const reconcile = async (): Promise<void> => {
    // Simulated offline severs all network activity, including the HTTP channel.
    if (!httpChannel || simulatedOffline) {
      return;
    }
    addSyncing(1);
    const startedAt = now();
    debugLog?.record({
      direction: "system",
      label: "reconcile start",
      phase: "start",
      type: "reconcile",
    });
    try {
      await bootstrapCollections({channel: httpChannel, collections: config.collections, store});
    } finally {
      addSyncing(-1);
      debugLog?.record({
        direction: "system",
        durationMs: now() - startedAt,
        label: "reconcile end",
        phase: "end",
        type: "reconcile",
      });
    }
  };

  const replayOutbox = async (): Promise<void> => {
    // While simulated-offline, mutations stay queued in the durable outbox
    // (replay would otherwise fall back to the HTTP channel and succeed).
    if (!currentUserId || simulatedOffline) {
      return;
    }
    addSyncing(1);
    const startedAt = now();
    const queued = outbox.listQueued({userId: currentUserId}).length;
    debugLog?.record({
      detail: {queued},
      direction: "system",
      label: `replay start (${queued} queued)`,
      phase: "start",
      type: "replay",
    });
    try {
      await coordinator.replay({userId: currentUserId});
    } finally {
      addSyncing(-1);
      debugLog?.record({
        direction: "system",
        durationMs: now() - startedAt,
        label: "replay end",
        phase: "end",
        type: "replay",
      });
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
    const {seqJump, applied} = applyDelta({delta, store});
    debugLog?.record({
      collection: delta.collection,
      detail: {applied, data: delta.data, deleted: delta.deleted === true, seqJump},
      direction: "inbound",
      entityId: delta.id,
      label: `delta ${delta.method} ${delta.collection}/${delta.id} @${delta.seq}`,
      operation: delta.method,
      seq: delta.seq,
      stream: delta.stream,
      type: "delta",
    });
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

  const startReconcileTimer = (): void => {
    const interval = config.reconcileIntervalMs ?? DEFAULT_RECONCILE_INTERVAL_MS;
    if (interval <= 0) {
      return;
    }
    reconcileTimer = setInterval(() => {
      void reconcile().catch(warn("periodic reconcile failed"));
      void replayOutbox().catch(warn("periodic replay failed"));
    }, interval);
  };

  const stopReconcileTimer = (): void => {
    if (reconcileTimer !== undefined) {
      clearInterval(reconcileTimer);
      reconcileTimer = undefined;
    }
  };

  const start = async (): Promise<void> => {
    const userId = await config.authProvider.getUserId();
    if (!userId) {
      throw new Error("createSyncDb.start() requires an authenticated user");
    }
    simulatedOffline = false;
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
    startReconcileTimer();
  };

  const stop = async (): Promise<void> => {
    stopReconcileTimer();
    simulatedOffline = false;
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

  const goOffline = (): void => {
    if (simulatedOffline) {
      return;
    }
    simulatedOffline = true;
    stopReconcileTimer();
    transport.disconnect();
    // The transport's own status event may arrive asynchronously; report the
    // disconnect now so status consumers (and the debug log) see it immediately.
    setConnected(false);
  };

  const goOnline = async (): Promise<void> => {
    if (!simulatedOffline) {
      return;
    }
    simulatedOffline = false;
    try {
      await transport.connect();
    } catch (error) {
      // Local-first: goOnline never throws; the transport's background
      // reconnection surfaces a later success through onStatusChange.
      warn("transport reconnect failed; still offline")(error);
    }
    // The (re)connect status event triggers reconcile + outbox replay via
    // handleStatusChange, and the transport re-subscribes its collections.
    startReconcileTimer();
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
    debugLog?.record({
      collection,
      detail: {baseVersion: existing?.seq, data},
      direction: "local",
      entityId,
      label: `${operation} ${collection}/${entityId}`,
      mutationId,
      operation,
      type: "mutate",
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
    debugLog?.record({
      detail: {strategy},
      direction: "local",
      label: `resolve conflict (${strategy})`,
      mutationId,
      type: "resolve",
    });
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
    debug: debugLog,
    getSyncStatus,
    goOffline,
    goOnline,
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
