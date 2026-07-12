import {DateTime} from "luxon";
import type {AnyPersister} from "tinybase/persisters";

import {createServerKeyProvider, DEFAULT_KEY_CACHE_DB_NAME} from "./crypto/keyProviders";
import type {KeyProvider} from "./crypto/types";
import {resolveDebugLog, type SyncDebugLog, type SyncDebugLogOptions} from "./debug/debugLog";
import {listConflicts} from "./mutations/conflicts";
import {createOutbox, generateMutationId, type Outbox} from "./mutations/outbox";
import {resolveConflict as applyConflictResolution} from "./mutations/resolveConflict";
import {createDefaultPersisterFactory} from "./persisters/defaultPersisterFactory";
import type {DefaultPersisterFactoryConfig, PersisterFactory} from "./persisters/types";
import {SYNC_SCHEMA_VERSION} from "./storage/schema";
import {createSyncStore, type SyncStore} from "./storage/store";
import {CURSORS_TABLE} from "./storage/types";
import {wipeLocalData} from "./storage/wipe";
import {bootstrapStream} from "./sync/bootstrap";
import {getAllCursors} from "./sync/cursor";
import {applyDelta} from "./sync/deltaApplier";
import {AuthRequiredError, createHttpChannel, type HttpChannel} from "./sync/httpChannel";
import {createReplayCoordinator, type ReplayCoordinator} from "./sync/replayCoordinator";
import {createSocketTransport} from "./sync/socketTransport";
import type {SendMutationBatchResult, SendMutationResult, SyncTransport} from "./sync/transport";
import type {
  AuthProvider,
  ConflictResolutionStrategy,
  SyncDelta,
  SyncMutateBatchRequest,
  SyncMutateRequest,
  SyncMutationOperation,
  SyncStatus,
} from "./types";

/** Periodic reconcile interval when not configured (5 minutes). */
export const DEFAULT_RECONCILE_INTERVAL_MS = 5 * 60_000;

/** Minimum interval between seq-jump-triggered reconciles per stream (30s). */
export const DEFAULT_SEQ_JUMP_RECONCILE_MIN_INTERVAL_MS = 30_000;

/** E5: default local tombstone retention window (90 days), matching the server's (C7). */
export const DEFAULT_TOMBSTONE_RETENTION_MS = 90 * 24 * 60 * 60 * 1_000;

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
  /**
   * Test-only IndexedDB read/write overrides forwarded to the default web
   * persister factory (e.g. to simulate a read error or a quota-exceeded
   * write in tests without a real broken IndexedDB). Ignored on native and
   * ignored entirely when `persisterFactory` is overridden.
   */
  idbGetImpl?: DefaultPersisterFactoryConfig["idbGetImpl"];
  idbSetImpl?: DefaultPersisterFactoryConfig["idbSetImpl"];
  /** Periodic reconcile interval in ms; 0 disables (default 5 minutes). */
  reconcileIntervalMs?: number;
  /** Rate limit for seq-jump-triggered reconciles per stream (default 30s). */
  seqJumpReconcileMinIntervalMs?: number;
  /** Millisecond clock, injectable for deterministic rate-limit tests. */
  now?: () => number;
  /** Random source in [0, 1), injectable for deterministic backoff-jitter tests. */
  random?: () => number;
  /**
   * Enable the in-memory debug event log (patches, mutations, acks/nacks,
   * conflicts, reconcile/replay, connectivity). `true` uses defaults; pass
   * options to size the buffer. Off by default — zero overhead when disabled.
   * Powers the sync debugger UI and the future MCP introspection surface.
   */
  debug?: boolean | SyncDebugLogOptions;
  /**
   * Fired at most once per auth-pause episode when the client enters
   * `paused: "auth"` (INV-2), so the host app can show a re-login prompt.
   * Clears and can fire again after a subsequent pause episode.
   */
  onAuthRequired?: () => void;
  /**
   * When true, `client.signOut()` wipes local data for the current user (in
   * addition to clearing auth state). Local data is otherwise NEVER wiped on
   * logout or 401 (INV-2) — only on a confirmed different-user login, or via
   * this explicit, host-app-initiated opt-in.
   */
  wipeOnSignOut?: boolean;
  /** Max mutations per batched drain send (B3, default 50; server caps at 100). */
  batchSize?: number;
  /**
   * B4: when true, a conflict halts the ENTIRE drain instead of just blocking
   * its entity. Default false (per-entity blocking — see README "Conflict
   * handling modes").
   */
  haltQueueOnConflict?: boolean;
  /**
   * E3(b): invoked when persisted local data cannot be decrypted (web only —
   * corrupt data, or a rotated/lost encryption key). DEFAULT BEHAVIOR when
   * omitted: wipe all local data for the current user, re-stamp the schema
   * version, and run a full snapshot re-bootstrap — always preceded by a
   * `console.warn`. Pass this to override that default (e.g. to prompt the
   * user before wiping); when provided, the client's own wipe/re-bootstrap is
   * skipped and the host app is fully responsible for recovery.
   */
  onDecryptFailure?: () => void;
  /**
   * E5: client-side compaction — local tombstone rows (`deleted: true`) older
   * than this window (from their `deletedAt` stamp) are deleted after each
   * successful reconcile. Default 90 days, matching the server's own
   * tombstone retention (C7); keep the two in sync — compacting locally
   * before the server's retention window elapses risks a client permanently
   * missing a delete it hasn't converged on yet. 0 disables compaction.
   */
  tombstoneRetentionMs?: number;
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
  /**
   * B4: re-enable an entity's queued successors after a terminal validation
   * failure blocked them. Does not touch unresolved conflicts (those clear
   * via `resolveConflict`); kicks off a replay so the re-enabled mutations
   * drain immediately rather than waiting for the next trigger.
   */
  retryFailed: (args: {entityId: string}) => void;
  /**
   * Explicit, host-app-initiated sign-out. Always clears the in-memory
   * current-user pointer; wipes local data ONLY when `wipeOnSignOut` is
   * configured (INV-2 — a bare 401/logout event never triggers this on its
   * own). Safe to call whether or not the client is currently paused.
   */
  signOut: () => Promise<void>;
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

  const store = createSyncStore({
    collections: config.collections,
    now: () => DateTime.fromMillis(now()).toISO() ?? new Date(now()).toISOString(),
  });
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
  // A4: auth-pause state. `authPaused` gates reconcile/replay/timer triggers
  // (INV-2 — nothing else may unpause except a same-user auth change).
  // `refreshAttempted` tracks whether the auth adapter's one-shot silent
  // refresh has already run for the CURRENT pause episode.
  let authPaused = false;
  let refreshAttempted = false;
  // E1: lifecycle serialization. `generation` bumps on every start()/stop() so
  // an in-flight operation that resumes after an await can detect it has been
  // superseded (a rapid stop()-then-start() for a new user) and abort instead
  // of mutating state (persister, currentUserId, listeners) that a LATER
  // operation already owns. `lifecycle` is a promise-chain mutex: every call
  // to start()/stop()/handleAuthChange()/runUserCheck() (the latter only ever
  // invoked FROM start()/handleAuthChange(), never directly) is appended to it
  // so at most one of these runs at a time, in call order — this is what
  // prevents the interleaving the mutex exists to fix, not the generation
  // check alone (the generation check only guards against a stale resume
  // AFTER an await; the chain prevents two lifecycle ops from running
  // concurrently in the first place).
  let generation = 0;
  let lifecycle: Promise<void> = Promise.resolve();
  /** True once a start() has completed without a matching stop() (E1 double-start guard). */
  let isStarted = false;

  /**
   * Queue `op` onto the lifecycle mutex; resolves/rejects with `op`'s own
   * outcome once every previously-queued op has settled. `lifecycle` itself
   * NEVER rejects (see below), so chaining with a plain `.then` is safe — a
   * prior op's failure never wedges the mutex or blocks later queued calls.
   */
  const withLifecycle = <T>(op: () => Promise<T>): Promise<T> => {
    const result = lifecycle.then(op);
    // Keep the chain alive regardless of this op's outcome; `result` itself
    // (returned below) carries the outcome to THIS call's caller.
    lifecycle = result.then(
      () => {},
      () => {}
    );
    return result;
  };

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

  // B3: batched sends mirror the same socket-preferred/HTTP-fallback selection.
  // Omitted entirely when neither channel supports batching, so the
  // coordinator falls back to sendMutation for every send.
  const sendMutationBatch =
    transport.sendMutationBatch || httpChannel?.sendMutationBatch
      ? async (request: SyncMutateBatchRequest): Promise<SendMutationBatchResult> => {
          if ((connected || !httpChannel) && transport.sendMutationBatch) {
            return transport.sendMutationBatch(request);
          }
          if (httpChannel?.sendMutationBatch) {
            return httpChannel.sendMutationBatch(request);
          }
          return {type: "unsupported"};
        }
      : undefined;

  const setAuthPaused = (value: boolean): void => {
    if (authPaused === value) {
      return;
    }
    authPaused = value;
    if (value) {
      refreshAttempted = false;
      config.onAuthRequired?.();
    } else {
      refreshAttempted = false;
    }
    notifyStatusChange();
  };

  const warn = (message: string): ((error: unknown) => void) => {
    return (error: unknown): void => {
      console.warn(`[syncdb] ${message}`, error);
    };
  };

  const coordinator: ReplayCoordinator = createReplayCoordinator({
    batchSize: config.batchSize,
    debug: debugLog,
    haltQueueOnConflict: config.haltQueueOnConflict,
    now,
    onAuthPause: () => {
      setAuthPaused(true);
      // Fire from the coordinator hook (not a replayOutbox() return-value
      // check): drain-until-empty's internal recheck/wake-timer continuations
      // can be the call that actually observes the auth failure, orphaned
      // from whichever replayOutbox() wrapper kicked off the original drain.
      // The hook fires exactly once per new pause episode regardless of which
      // internal call triggered it.
      void attemptAuthRecovery();
    },
    onDrainPass: ({userId}) => {
      outbox.prune({userId});
    },
    onProgress: () => {
      // B5: drain progress (sentThisDrain/totalThisDrain) is exposed through
      // getSyncStatus() — nudge status listeners so a progress UI re-renders
      // as each chunk/mutation resolves, not just at the start/end of replay.
      notifyStatusChange();
    },
    outbox,
    random: config.random,
    sendMutation,
    sendMutationBatch,
    // Internally-scheduled drains (armed wake-up timers, the mid-drain-enqueue
    // recheck) must respect the same gating as an external replayOutbox()
    // call: never send while simulated-offline or auth-paused.
    shouldDrain: () => !simulatedOffline && !authPaused,
    store,
  });

  /**
   * C2: discover the streams the user currently belongs to (`GET /sync/streams`), then
   * diff against the persisted `_knownStreams` set to detect joins and leaves.
   *
   * INV-2 (the whole ballgame): the leave-purge only runs when `fetchStreams` returned
   * HTTP 200. A 401 (AuthRequiredError) or any transport error is NOT a membership
   * change — it enters auth-pause (401) or is rethrown (transport) with every local
   * entity, cursor, and known-stream entry left intact. Joins backfill from cursor 0;
   * leaves purge that stream's local entities + cursor + known-stream entry.
   *
   * Returns the current membership set (stream → collection) on success so the caller
   * can bootstrap each; returns `undefined` when auth-paused (no membership known).
   */
  const syncStreams = async ({
    isSuperseded,
  }: {
    /**
     * Optional lifecycle guard checked AFTER the network fetch resolves but BEFORE any
     * store mutation. A fired-and-forgotten reconcile's `fetchStreams()` await can straddle
     * a stop()/start() or different-user wipe; without this, the post-await store reads and
     * purges/joins below run against the swapped-in store and can resurrect wiped rows via
     * TinyBase's mergeable-schema re-materialization. Returns undefined when superseded.
     */
    isSuperseded?: () => boolean;
  } = {}): Promise<Map<string, string> | undefined> => {
    if (!httpChannel) {
      // No HTTP channel: fall back to the configured collections' streams are unknown;
      // bootstrap cannot run. Callers treat undefined as "skip stream sync".
      return undefined;
    }
    let serverStreams: {stream: string; collection: string}[];
    try {
      serverStreams = await httpChannel.fetchStreams();
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        // INV-2: a 401 is NOT a leave. Pause; leave every stream/entity intact.
        setAuthPaused(true);
        return undefined;
      }
      // Transport error: also not a membership change — leave data intact, rethrow so
      // the caller's catch handles retry/backoff.
      throw error;
    }
    if (isSuperseded?.()) {
      // A newer lifecycle/user took over during the fetch — do not touch the store.
      return undefined;
    }

    const serverSet = new Map<string, string>();
    for (const {stream, collection} of serverStreams) {
      serverSet.set(stream, collection);
    }
    const known = new Set(store.getKnownStreams());

    // Leaves: known locally but absent from the (HTTP-200) server set → purge.
    for (const stream of known) {
      if (!serverSet.has(stream)) {
        const purged = store.purgeStream({stream});
        debugLog?.record({
          detail: {purged, stream},
          direction: "system",
          label: `stream leave: purged ${stream} (${purged} entities)`,
          type: "reconcile",
        });
      }
    }
    // Joins: in the server set but not yet known → mark known (cursor 0 bootstrap follows).
    for (const [stream, collection] of serverSet) {
      if (!known.has(stream)) {
        store.addKnownStream({collection, stream});
        debugLog?.record({
          detail: {collection, stream},
          direction: "system",
          label: `stream join: ${stream}`,
          type: "reconcile",
        });
      }
    }
    return serverSet;
  };

  const reconcile = async (): Promise<void> => {
    // Simulated offline severs all network activity, including the HTTP
    // channel; an auth pause stands down every network trigger (INV-2) until
    // the same user re-authenticates.
    if (!httpChannel || simulatedOffline || authPaused) {
      return;
    }
    // E1 + C2: reconcile is fired-and-forgotten (startup, reconnect, periodic,
    // post-auth) and its network awaits below can straddle a stop()/start() (bumps
    // `generation`) or a different-user switch (changes `currentUserId` + swaps the
    // persister, via runUserCheck). Capture both at entry and re-check after every await
    // so a stale reconcile never writes discovered streams or snapshot pages into a store
    // that now belongs to a different lifecycle or user — the resurrection bug where an
    // in-flight reconcile for the previous user re-materialized purged rows after a wipe.
    const myGeneration = generation;
    const myUserId = currentUserId;
    const isSuperseded = (): boolean => generation !== myGeneration || currentUserId !== myUserId;
    addSyncing(1);
    const startedAt = now();
    debugLog?.record({
      direction: "system",
      label: "reconcile start",
      phase: "start",
      type: "reconcile",
    });
    try {
      const streams = await syncStreams({isSuperseded});
      if (!streams || isSuperseded()) {
        // Auth-paused during discovery (401 → INV-2), or superseded by a newer
        // lifecycle/user while awaiting discovery.
        return;
      }
      for (const [stream, collection] of streams) {
        await bootstrapStream({channel: httpChannel, collection, store, stream});
        if (isSuperseded()) {
          return;
        }
      }
      // E5: client-side compaction runs only after a successful per-stream reconcile —
      // reconcile just proved the local store caught up with the server via real network
      // round trips (discovery + each stream), which is the signal that it is safe to age
      // out old tombstones (never on a failed/incomplete reconcile).
      const retentionMs = config.tombstoneRetentionMs ?? DEFAULT_TOMBSTONE_RETENTION_MS;
      if (retentionMs > 0) {
        // No explicit `now` override here — compactTombstones defaults to the same
        // injected clock the store itself was created with above.
        const {removed} = store.compactTombstones({olderThanMs: retentionMs});
        if (removed > 0) {
          debugLog?.record({
            detail: {removed},
            direction: "system",
            label: `compacted ${removed} tombstone(s)`,
            type: "reconcile",
          });
        }
      }
    } catch (error) {
      if (error instanceof AuthRequiredError) {
        setAuthPaused(true);
        return;
      }
      throw error;
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

  /**
   * C2 migration: deployed clients hold legacy `snapshot:{collection}` pseudo-cursors.
   * On start, delete all of them and clear `_knownStreams` so the normal discovery path
   * re-bootstraps every stream from cursor 0. Idempotent upserts + seq guards make
   * re-bootstrap cheap and non-destructive (existing entities keep their data). Runs once.
   *
   * NOTE (Phase E merge): Phase E is adding the schema-version wipe machinery in the main
   * worktree. Ideally this migration gates behind that version bump so it runs exactly
   * once. That hook does not exist in this worktree, so this implements the minimal
   * standalone cursor-migration path — it is self-idempotent (after the first run there
   * are no `snapshot:` keys left, so subsequent runs are no-ops). When merging, this can
   * be moved behind the E2 version bump.
   */
  const migrateLegacySnapshotCursors = (): void => {
    const cursorRows = store.raw.getTable(CURSORS_TABLE);
    let migrated = 0;
    for (const key of Object.keys(cursorRows)) {
      if (key.startsWith("snapshot:")) {
        store.raw.delRow(CURSORS_TABLE, key);
        migrated += 1;
      }
    }
    if (migrated > 0) {
      // Clear the known-streams set so discovery re-bootstraps every stream from 0.
      for (const stream of store.getKnownStreams()) {
        store.removeKnownStream({stream});
      }
      debugLog?.record({
        detail: {migrated},
        direction: "system",
        label: `migrated ${migrated} legacy snapshot cursors`,
        type: "reconcile",
      });
    }
  };

  const replayOutbox = async (): Promise<void> => {
    // While simulated-offline or auth-paused, mutations stay queued in the
    // durable outbox (INV-2: an auth pause stands down replay until the same
    // user re-authenticates).
    if (!currentUserId || simulatedOffline || authPaused) {
      return;
    }
    addSyncing(1);
    const startedAt = now();
    // A3: this listQueued scan exists purely to label a debug event — never
    // pay for it when debug logging is disabled (the common case).
    if (debugLog) {
      const queued = outbox.listQueued({userId: currentUserId}).length;
      debugLog.record({
        detail: {queued},
        direction: "system",
        label: `replay start (${queued} queued)`,
        phase: "start",
        type: "replay",
      });
    }
    try {
      // Auth-pause recovery (the one-shot silent refresh) is wired through
      // the coordinator's onAuthPause hook, not this return value — it fires
      // reliably regardless of which internal call (this one, the wake
      // timer, or the mid-drain recheck) is the one that actually observes
      // the auth failure.
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

  /**
   * Give the auth adapter one chance to silently refresh before the pause is
   * fully surfaced to the app (A4 step 5). Runs at most once per pause
   * episode; a successful refresh immediately retries replay.
   */
  const attemptAuthRecovery = async (): Promise<void> => {
    if (refreshAttempted || !config.authProvider.refresh) {
      return;
    }
    refreshAttempted = true;
    try {
      const refreshed = await config.authProvider.refresh();
      if (refreshed && authPaused) {
        setAuthPaused(false);
        void replayOutbox().catch(warn("post-refresh replay failed"));
      }
    } catch (error) {
      warn("auth refresh attempt failed")(error);
    }
  };

  /**
   * E3(c): the web factory (`persisters/defaultPersisterFactory.web.ts`) falls
   * back to the in-memory persister when `globalThis.indexedDB` is absent
   * (private browsing / a locked-down embedded webview), emitting a one-time
   * console.warn. That fallback is invisible to the caller unless it inspects
   * the returned persister — surface it on the client's status instead so a
   * host app can tell durable persistence apart from a session that silently
   * never survives reload. Defaults to "durable"; a persister factory may
   * report "memory" via `persister.persistenceMode` (see
   * `defaultPersisterFactory.web.ts`), and a load failure (E3a) downgrades to
   * "error" for the remainder of the session.
   */
  let persistenceMode: "durable" | "memory" | "error" = "durable";

  const createAndStartPersister = async (userId: string): Promise<void> => {
    // Reset per-call: a fresh persister/load attempt starts optimistic even
    // if a PRIOR persister instance (e.g. before a wipe-and-rebuild) had
    // flagged a load failure.
    persistenceMode = "durable";
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
    // E3(b): decrypt/corrupt-data failures wipe + re-bootstrap by default
    // (documented behavior) unless the host app overrides via
    // `config.onDecryptFailure`. Either way it always warns.
    const onDecryptFailure = (): void => {
      console.warn(
        `[syncdb] persisted data for "${config.name}" could not be decrypted; wiping and re-bootstrapping`
      );
      if (config.onDecryptFailure) {
        config.onDecryptFailure();
        return;
      }
      void wipeAndRebootstrap(userId).catch(warn("post-decrypt-failure wipe/rebootstrap failed"));
    };
    // E3(a): a read ERROR (not "no data") must never be treated as a fresh
    // store — flag it so the caller skips autosave (which would otherwise
    // overwrite the still-good persisted blob with an empty in-memory store).
    const onLoadFailure = (): void => {
      persistenceMode = "error";
      console.warn(
        `[syncdb] failed to read persisted data for "${config.name}"; leaving the stored snapshot untouched this session`
      );
      notifyStatusChange();
    };
    // E3(a): a save (write) failure — e.g. IndexedDB quota exceeded — is
    // surfaced the same way: local writes are no longer reliably durable this
    // session, so the host app should warn the user rather than silently
    // losing data. Unlike a load failure this does NOT skip future save
    // attempts (a transient quota issue may clear once the user frees space).
    const onSaveFailure = (error: unknown): void => {
      persistenceMode = "error";
      console.warn(`[syncdb] failed to persist local data for "${config.name}"`, error);
      notifyStatusChange();
    };
    const factory =
      config.persisterFactory ??
      createDefaultPersisterFactory({
        idbGetImpl: config.idbGetImpl,
        idbSetImpl: config.idbSetImpl,
        keyProvider,
        onDecryptFailure,
        onLoadFailure,
        onSaveFailure,
        userId,
      });
    // `hooks` is always passed (even to a custom persisterFactory) so a host
    // app supplying its own storage backend can still opt into E3 SyncStatus
    // surfacing; the default factory already received the same callbacks
    // above (at creation time) and ignores this second copy.
    persister = factory({
      databaseName: config.name,
      hooks: {onDecryptFailure, onLoadFailure, onSaveFailure},
      store: store.raw,
    });
    await persister.startAutoLoad();
    // Read through a function call: `onLoadFailure` (invoked synchronously
    // from inside `startAutoLoad()`, not after it returns) mutates
    // `persistenceMode` by closure, which TypeScript's control-flow narrowing
    // cannot see across the awaited call above — without this indirection it
    // would (wrongly) treat the "durable" assignment at the top of this
    // function as still in effect here.
    const getPersistenceMode = (): typeof persistenceMode => persistenceMode;
    if (getPersistenceMode() === "error") {
      // Do NOT startAutoSave(): the in-memory store is empty (load bailed out
      // before touching it) and autosaving now would clobber the real blob.
      return;
    }
    // E3(c): the web factory tags its returned persister with a
    // `persistenceMode` marker when it fell back to in-memory (no
    // globalThis.indexedDB) — surface that on SyncStatus.
    const reportedMode = (persister as AnyPersister & {persistenceMode?: "durable" | "memory"})
      .persistenceMode;
    if (reportedMode === "memory") {
      persistenceMode = "memory";
      notifyStatusChange();
    }
    await persister.startAutoSave();
  };

  /**
   * Sanctioned wipe + fresh start for `userId`: clears every local table and
   * the persisted databases (including cached encryption keys — E3f), stamps
   * the current schema version and userId on the now-empty store, rebuilds
   * the persister, and — when an HTTP channel is available — runs a full
   * snapshot re-bootstrap so the app is immediately usable again rather than
   * waiting for the next reconcile trigger. Shared by the E2 schema-mismatch
   * path and the E3(b) decrypt-failure default handler; NOT used for the
   * different-user wipe (that path's re-bootstrap comes from the caller's own
   * subsequent reconcile()/replayOutbox() calls, matching pre-E2 behavior).
   */
  const wipeAndRebootstrap = async (userId: string): Promise<void> => {
    coordinator.reset();
    await wipeLocalData({
      databaseNames: [config.name],
      keyCacheDbNames: [DEFAULT_KEY_CACHE_DB_NAME],
      persister,
      store,
    });
    lastSeqJumpReconcileAt.clear();
    persistenceMode = "durable";
    await createAndStartPersister(userId);
    store.raw.setValue("schemaVersion", SYNC_SCHEMA_VERSION);
    store.setLastUserId({userId});
    currentUserId = userId;
    if (httpChannel) {
      // C2: after a wipe the known-streams set is empty, so discover the user's current
      // stream membership and bootstrap each from cursor 0. syncStreams() handles the
      // INV-2 auth-pause case (returns undefined on a 401) — skip bootstrap then.
      const streams = await syncStreams();
      if (streams) {
        for (const [stream, collection] of streams) {
          await bootstrapStream({channel: httpChannel, collection, store, stream});
        }
      }
    }
  };

  /**
   * Wipe-on-user-change: when the persisted `lastUserId` differs from the
   * authenticated user, destroy all local data (entities, outbox, cursors,
   * conflicts, persisted databases) and start fresh for the new user.
   *
   * E2: also checked here (after the persister's autoload has populated the
   * store from disk) is the persisted schema version — a mismatch is a
   * sanctioned wipe (schema migration, not an auth event) distinct from the
   * user-change wipe above, so it runs regardless of whether the user changed.
   */
  const runUserCheck = async (userId: string): Promise<void> => {
    const lastUserId = store.getLastUserId();
    if (lastUserId !== undefined && lastUserId !== userId) {
      // FIX 3: a different-user login must not let the PREVIOUS user's
      // in-memory coordinator state (validationBlockedEntities keyed
      // user-scoped, retry/backoff bookkeeping, the batch-capability latch,
      // armed timers) leak into the new user's session — reset before the
      // new user's persister/outbox come online.
      coordinator.reset();
      // E3(f): also clear the cached derived encryption key for the key-cache
      // database — the same rationale as wiping local data: nothing from the
      // previous user's session should linger once a different user has
      // authenticated (the new user's persister derives/caches its own key
      // fresh via createAndStartPersister below).
      await wipeLocalData({
        databaseNames: [config.name],
        keyCacheDbNames: [DEFAULT_KEY_CACHE_DB_NAME],
        persister,
        store,
      });
      lastSeqJumpReconcileAt.clear();
      await createAndStartPersister(userId);
    }
    // E2: schema version check. `getSchemaVersion()` reads the persisted
    // value with a same-as-current default (so a genuinely fresh store never
    // trips this), meaning a real mismatch can only come from a persisted
    // store written under an OLDER `SYNC_SCHEMA_VERSION`. Always stamp the
    // current version afterward so a fresh store (and one just wiped above)
    // is never mistaken for stale on the next start().
    const persistedVersion = store.getSchemaVersion();
    if (persistedVersion !== SYNC_SCHEMA_VERSION) {
      await wipeAndRebootstrap(userId);
      return;
    }
    store.raw.setValue("schemaVersion", SYNC_SCHEMA_VERSION);
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

  const handleStatusChange = ({
    connected: isConnected,
    authExpired,
  }: {
    connected: boolean;
    authExpired?: boolean;
  }): void => {
    setConnected(isConnected);
    if (!isConnected) {
      // D1: the server's session re-validation sweep disconnected this socket
      // (sync:auth-expired). Map straight into the existing A4 auth-pause path —
      // INV-2: no wipe, outbox untouched, zero retry budget consumed. The
      // reconnect attempt Socket.io makes on its own will keep failing the
      // handshake with the same expired/invalid credentials until the host app
      // re-authenticates (handleAuthChange clears the pause on same-user re-auth).
      if (authExpired) {
        setAuthPaused(true);
      }
      return;
    }
    // B3: re-probe batch support on every reconnect — a previous
    // `batchUnsupported` determination may have been against an old server
    // that has since been upgraded, or the reconnect landed on a different
    // instance behind a load balancer.
    coordinator.notifyReconnect();
    void reconcile().catch(warn("reconnect reconcile failed"));
    void replayOutbox().catch(warn("reconnect replay failed"));
  };

  /**
   * E1: `handleAuthChange` goes through the SAME lifecycle mutex as
   * `start`/`stop` — it mutates the same shared state (`currentUserId`,
   * `persister` via `runUserCheck`) that a concurrent stop()/start() would.
   * Queuing it here means a rapid stop()-then-start() for a new user can
   * never interleave with an in-flight auth-change handler from the OLD
   * user's session; whichever queued first fully completes before the next
   * runs. The generation check additionally covers the case where THIS
   * handler itself is stale — e.g. it was queued behind a stop() while
   * `getUserId()` resolves, and by the time it runs a fresh generation has
   * already started up for a different user.
   */
  const handleAuthChange = (): void => {
    void withLifecycle(async (): Promise<void> => {
      const myGeneration = generation;
      const userId = await config.authProvider.getUserId();
      if (generation !== myGeneration) {
        // Superseded by a stop()/start() while awaiting the auth provider —
        // that operation now owns currentUserId/persister; do nothing.
        return;
      }
      if (!userId) {
        // Logged out: NEVER wipe (INV-2). Keep all local data, clear the
        // current-user pointer (mutate() requires start() again), and remain
        // paused — reconcile/replay stand down until the same user (or a
        // different one, via the wipe path below) re-authenticates.
        currentUserId = undefined;
        setAuthPaused(true);
        return;
      }
      if (userId === currentUserId) {
        // Same-user re-auth: the pause (if any) clears fully and replay
        // resumes with the outbox completely intact.
        setAuthPaused(false);
        void replayOutbox().catch(warn("post-auth replay failed"));
        return;
      }
      // Different userId: existing wipe-on-user-change behavior, or a first
      // login after a logout (currentUserId undefined) — either way this is a
      // confirmed identity change, never inferred from a bare 401.
      await runUserCheck(userId);
      if (generation !== myGeneration) {
        return;
      }
      setAuthPaused(false);
      void reconcile().catch(warn("post-auth reconcile failed"));
      void replayOutbox().catch(warn("post-auth replay failed"));
    }).catch(warn("auth change handling failed"));
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

  /**
   * E1: lifecycle serialization. `start`/`stop` both queue through the same
   * `lifecycle` mutex as `handleAuthChange`, so at most one of these ever
   * runs at a time, in call order — the bug this fixes was a `stop()`
   * re-reading the module-level `persister` after awaiting a debounced
   * `save()`, by which point an interleaved `start()` for a new user had
   * already replaced it, destroying the NEW user's persister instead of the
   * old one. On top of mutual exclusion, every operation captures its own
   * `myGeneration` and re-checks `generation === myGeneration` after each
   * `await` — belt-and-suspenders against any future call site that manages
   * to bypass the mutex (e.g. a direct call from a test), and cheap enough to
   * always do.
   */
  const start = async (): Promise<void> =>
    withLifecycle(async (): Promise<void> => {
      if (isStarted) {
        // E1: double-start() is a no-op rather than a second full
        // initialization — calling start() again would double-register the
        // transport/auth-change listeners and leak a second reconcile timer.
        // A caller that wants a hard restart should stop() first.
        return;
      }
      generation += 1;
      const myGeneration = generation;
      const userId = await config.authProvider.getUserId();
      if (!userId) {
        throw new Error("createSyncDb.start() requires an authenticated user");
      }
      if (generation !== myGeneration) {
        // A stop() (or another start()) ran while awaiting the auth
        // provider — that operation now owns the lifecycle; abandon this one
        // rather than initializing state a newer generation doesn't expect.
        return;
      }
      simulatedOffline = false;
      setAuthPaused(false);
      await createAndStartPersister(userId);
      if (generation !== myGeneration) {
        return;
      }
      await runUserCheck(userId);
      if (generation !== myGeneration) {
        return;
      }

      // C2: migrate any legacy snapshot:{collection} cursors before the first discovery
      // so the per-stream bootstrap path starts from a clean cursor set. This is a cheap,
      // idempotent fast-path — Phase E's schema-version wipe (runUserCheck ->
      // wipeAndRebootstrap) already re-bootstraps any store still on v1, so in practice no
      // v2 store carries legacy `snapshot:` cursors. Kept because it costs one table scan
      // and lets a v2-with-legacy-cursors store (which should not exist) recover without a
      // full wipe; after the first run there are no `snapshot:` keys left, so it no-ops.
      migrateLegacySnapshotCursors();

      // A1: startup crash recovery, before the first replayOutbox() — repair
      // any outbox rows stranded mid-lifecycle by a prior crash/reload (inFlight
      // never resolved, acked-with-still-pending entity, conflicted with no
      // conflict row written).
      const recovery = outbox.recoverStartupState({userId});
      debugLog?.record({
        detail: {...recovery},
        direction: "system",
        label: `startup recovery (${recovery.recoveredInFlight.length} inFlight, ${recovery.releasedEntities.length} released, ${recovery.repairedConflicts.length} conflicts repaired)`,
        type: "reconcile",
      });

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
      if (generation !== myGeneration) {
        return;
      }
      transport.subscribe(config.collections);
      // C2: run an initial stream discovery + per-stream bootstrap on start (not only via
      // the reconnect status event) so a client that starts offline-then-online, or with a
      // warm socket, still backfills newly-joined streams and drains legacy cursors.
      void reconcile().catch(warn("startup reconcile failed"));
      startReconcileTimer();
      isStarted = true;
      void replayOutbox().catch(warn("startup replay failed"));
    });

  const stop = async (): Promise<void> =>
    withLifecycle(async (): Promise<void> => {
      generation += 1;
      isStarted = false;
      stopReconcileTimer();
      simulatedOffline = false;
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      unsubscribers = [];
      transport.disconnect();
      setConnected(false);
      coordinator.dispose(currentUserId ? {userId: currentUserId} : undefined);
      // Capture the persister into a local BEFORE the awaits below: this is
      // the exact fix for the original bug (a later start() calling
      // createAndStartPersister() reassigns the module-level `persister`
      // binding, so re-reading it after the await would destroy the NEW
      // user's persister instead of this stop()'s). The mutex already
      // prevents that interleaving, but capturing the local costs nothing and
      // remains correct even if that invariant is ever relaxed.
      const persisterToStop = persister;
      persister = undefined;
      currentUserId = undefined;
      if (persisterToStop) {
        // Flush any pending autosave so a clean stop never loses local writes.
        await persisterToStop.save();
        await persisterToStop.destroy();
      }
    });

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

  const retryFailed = ({entityId}: {entityId: string}): void => {
    coordinator.retryFailed({entityId});
    debugLog?.record({
      detail: {entityId},
      direction: "local",
      label: `retry failed (${entityId})`,
      type: "resolve",
    });
    void replayOutbox().catch(warn("post-retryFailed replay failed"));
  };

  const getSyncStatus = (): SyncStatus => {
    const drainProgress = currentUserId
      ? coordinator.getDrainProgress({userId: currentUserId})
      : {draining: false, sentThisDrain: 0, totalThisDrain: 0};
    return {
      blockedEntities: currentUserId
        ? coordinator.getBlockedEntities({userId: currentUserId}).length
        : 0,
      conflictCount: listConflicts({store}).length,
      draining: drainProgress.draining,
      failedCount: currentUserId
        ? outbox.countByStatus({status: "failed", userId: currentUserId})
        : 0,
      isOnline: connected,
      isSyncing: syncingCount > 0,
      ...(authPaused ? {paused: "auth" as const} : {}),
      persistence: persistenceMode,
      queuedCount: currentUserId ? outbox.listQueued({userId: currentUserId}).length : 0,
      sentThisDrain: drainProgress.sentThisDrain,
      streams: getAllCursors({store}),
      totalThisDrain: drainProgress.totalThisDrain,
    };
  };

  const onStatusChange = (callback: () => void): (() => void) => {
    statusListeners.add(callback);
    return () => {
      statusListeners.delete(callback);
    };
  };

  const signOut = async (): Promise<void> => {
    const userId = currentUserId;
    setAuthPaused(false);
    currentUserId = undefined;
    if (userId && config.wipeOnSignOut) {
      coordinator.dispose({userId});
      await wipeLocalData({databaseNames: [config.name], persister, store});
      lastSeqJumpReconcileAt.clear();
    }
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
    retryFailed,
    signOut,
    start,
    stop,
    store,
  };
};
