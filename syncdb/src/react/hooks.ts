/**
 * React hooks over the SyncDb client.
 *
 * Reactivity is wired directly onto the raw TinyBase MergeableStore via
 * `addRowListener`/`addTableListener` + `useSyncExternalStore` rather than
 * `tinybase/ui-react`: ui-react hooks return raw rows/tables while these hooks
 * return the decoded entity shapes (the `data` cell is JSON-encoded), and
 * binding listeners ourselves keeps the React surface down to a single `react`
 * peer dependency. No DOM APIs are used, so everything here is React Native
 * (and RNW) compatible.
 */

import {useCallback, useLayoutEffect, useRef, useSyncExternalStore} from "react";

import type {SyncDebugEvent, SyncDebugLog, SyncDebugStats} from "../debug/debugLog";
import {listConflicts} from "../mutations/conflicts";
import {CONFLICTS_TABLE, CURSORS_TABLE, OUTBOX_TABLE} from "../storage/types";
import type {ConflictResolutionStrategy, SyncConflict, SyncStatus} from "../types";
import {useSyncDbClient} from "./provider";

/**
 * `useSyncExternalStore` wrapper that caches the selected value by structural
 * (JSON) equality, so selectors returning fresh objects/arrays keep a stable
 * identity across unrelated renders and never cause render loops.
 */
const useCachedExternalStore = <T>(
  subscribe: (onChange: () => void) => () => void,
  select: () => T
): T => {
  const cache = useRef<{json: string; value: T} | null>(null);
  const getSnapshot = useCallback((): T => {
    const value = select();
    const json = JSON.stringify(value ?? null);
    if (cache.current && cache.current.json === json) {
      return cache.current.value;
    }
    cache.current = {json, value};
    return value;
  }, [select]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};

export interface UseEntityResult<TData> {
  /** Decoded entity payload, or undefined when the entity does not exist locally. */
  data: TData | undefined;
  /** Soft-delete tombstone flag. */
  deleted: boolean;
  /** Highest server seq applied to the entity (0 = local-only). */
  seq: number;
  /** True while an outbox mutation is protecting this entity's optimistic state. */
  isPending: boolean;
}

/** Subscribe to a single entity; re-renders when that row changes. */
export const useEntity = <TData = Record<string, unknown>>(
  collection: string,
  id: string
): UseEntityResult<TData> => {
  const client = useSyncDbClient();

  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const listenerId = client.store.raw.addRowListener(collection, id, onChange);
      return () => {
        client.store.raw.delListener(listenerId);
      };
    },
    [client, collection, id]
  );

  const select = useCallback((): UseEntityResult<TData> => {
    const entity = client.store.getEntity<TData>({collection, id});
    if (!entity) {
      return {data: undefined, deleted: false, isPending: false, seq: 0};
    }
    return {
      data: entity.data ?? undefined,
      deleted: entity.deleted,
      isPending: entity.pendingMutationId !== undefined,
      seq: entity.seq,
    };
  }, [client, collection, id]);

  return useCachedExternalStore(subscribe, select);
};

export interface UseQueryOptions<TData> {
  /** Keep only entities whose decoded data passes the predicate (runs in JS). */
  filter?: (data: TData) => boolean;
  /** Sort comparator over decoded data (runs in JS on a copy). */
  sort?: (a: TData, b: TData) => number;
  /** Include soft-deleted (tombstoned) entities; excluded by default. */
  includeDeleted?: boolean;
}

/**
 * Subscribe to a collection; returns the entities' decoded data (memoized by
 * structural equality) and re-renders on any table change. Tombstones are
 * excluded unless `includeDeleted` is set; filter and sort run in JS.
 */
export const useQuery = <TData = Record<string, unknown>>(
  collection: string,
  options?: UseQueryOptions<TData>
): TData[] => {
  const client = useSyncDbClient();

  // Filter/sort callbacks are usually inline (fresh identity every render);
  // reading them through a ref keeps `select` stable so the snapshot cache and
  // the store subscription survive re-renders.
  const optionsRef = useRef(options);
  // E4: assigning a ref during render is a side effect against React's render
  // model (StrictMode double-invokes render bodies specifically to surface
  // this class of bug) — moved into a layout effect, which still runs before
  // the browser paints (and before any synchronous store-listener callback
  // triggered by an event between render and the passive-effect phase could
  // observe a stale ref).
  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const listenerId = client.store.raw.addTableListener(collection, onChange);
      return () => {
        client.store.raw.delListener(listenerId);
      };
    },
    [client, collection]
  );

  const select = useCallback((): TData[] => {
    const current = optionsRef.current;
    const entities = client.store.listEntities<TData>({
      collection,
      includeDeleted: current?.includeDeleted,
    });
    // E4: a corrupt/legacy row decodes to `data: null` (store.ts's decodeData
    // swallows JSON.parse failures and returns null rather than throwing) —
    // skip it here rather than letting it crash list consumers that assume
    // every row's data matches TData (e.g. destructuring a field off it).
    let results = entities.filter((entity) => entity.data !== null).map((entity) => entity.data);
    if (current?.filter) {
      results = results.filter(current.filter);
    }
    if (current?.sort) {
      results = [...results].sort(current.sort);
    }
    return results;
  }, [client, collection]);

  return useCachedExternalStore(subscribe, select);
};

export interface UseMutateResult {
  /** Optimistically create an entity; returns the generated ids. */
  create: (args: {data: Record<string, unknown>}) => {mutationId: string; id: string};
  /** Optimistically merge fields into an existing entity. */
  update: (args: {id: string; data: Record<string, unknown>}) => {mutationId: string; id: string};
  /** Optimistically soft-delete an entity. */
  remove: (args: {id: string}) => {mutationId: string; id: string};
}

/**
 * Collection-scoped mutation helpers wrapping `client.mutate`: each applies
 * locally, enqueues a durable outbox mutation, and kicks off replay.
 */
export const useMutate = (collection: string): UseMutateResult => {
  const client = useSyncDbClient();

  const create = useCallback(
    (args: {data: Record<string, unknown>}): {mutationId: string; id: string} =>
      client.mutate({collection, data: args.data, operation: "create"}),
    [client, collection]
  );

  const update = useCallback(
    (args: {id: string; data: Record<string, unknown>}): {mutationId: string; id: string} =>
      client.mutate({collection, data: args.data, id: args.id, operation: "update"}),
    [client, collection]
  );

  const remove = useCallback(
    (args: {id: string}): {mutationId: string; id: string} =>
      client.mutate({collection, id: args.id, operation: "delete"}),
    [client, collection]
  );

  return {create, remove, update};
};

/**
 * Aggregate sync status; re-renders when any status input changes. Store-backed
 * inputs (queued outbox rows, conflicts, stream cursors) are observed through
 * table listeners; connectivity and syncing activity arrive through the
 * client's `onStatusChange` passthrough.
 */
export const useSyncStatus = (): SyncStatus => {
  const client = useSyncDbClient();

  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const unsubStatus = client.onStatusChange(onChange);
      const outboxListener = client.store.raw.addTableListener(OUTBOX_TABLE, onChange);
      const conflictsListener = client.store.raw.addTableListener(CONFLICTS_TABLE, onChange);
      const cursorsListener = client.store.raw.addTableListener(CURSORS_TABLE, onChange);
      return () => {
        unsubStatus();
        client.store.raw.delListener(outboxListener);
        client.store.raw.delListener(conflictsListener);
        client.store.raw.delListener(cursorsListener);
      };
    },
    [client]
  );

  const select = useCallback((): SyncStatus => client.getSyncStatus(), [client]);

  return useCachedExternalStore(subscribe, select);
};

export interface UseConflictsResult {
  /** Unresolved conflicts (dismissed rows excluded). */
  conflicts: SyncConflict[];
  /** Resolve a conflict with `useServer` or `keepMine`. */
  resolve: (args: {mutationId: string; strategy: ConflictResolutionStrategy}) => void;
}

/** Subscribe to unresolved conflicts and expose the client's resolver. */
export const useConflicts = (): UseConflictsResult => {
  const client = useSyncDbClient();

  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const listenerId = client.store.raw.addTableListener(CONFLICTS_TABLE, onChange);
      return () => {
        client.store.raw.delListener(listenerId);
      };
    },
    [client]
  );

  const select = useCallback((): SyncConflict[] => listConflicts({store: client.store}), [client]);

  const conflicts = useCachedExternalStore(subscribe, select);

  const resolve = useCallback(
    (args: {mutationId: string; strategy: ConflictResolutionStrategy}): void => {
      client.resolveConflict(args);
    },
    [client]
  );

  return {conflicts, resolve};
};

export interface UseSyncDebugLogResult {
  /** True when the client was created with `debug` enabled. */
  enabled: boolean;
  /** Recorded events, oldest → newest (empty when disabled). */
  events: SyncDebugEvent[];
  /** Aggregate counters (undefined when disabled). */
  stats: SyncDebugStats | undefined;
  /** The underlying log, for `snapshot()`/`clear()` (undefined when disabled). */
  log: SyncDebugLog | undefined;
  /** Drop all retained events and reset `stats` to describe the now-empty log (a no-op when disabled). */
  clear: () => void;
}

const EMPTY_EVENTS: SyncDebugEvent[] = [];

/**
 * Subscribe to the client's debug event log (see `createSyncDb({debug: true})`).
 *
 * Reactivity is driven by the log's monotonic revision through
 * `useSyncExternalStore`, so a burst of events triggers at most one render per
 * commit. `events` is read fresh from the ring buffer on each render (O(capacity),
 * capacity defaults to 500) — cheap enough for a live debugger and stable when
 * nothing changed because the revision is unchanged.
 */
export const useSyncDebugLog = (): UseSyncDebugLogResult => {
  const client = useSyncDbClient();
  const log = client.debug;

  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      if (!log) {
        return () => {};
      }
      return log.subscribe(onChange);
    },
    [log]
  );

  const getRevision = useCallback((): number => log?.getRevision() ?? 0, [log]);

  // The revision changes on every record/clear; reading it re-renders the hook.
  useSyncExternalStore(subscribe, getRevision, getRevision);

  const clear = useCallback((): void => {
    log?.clear();
  }, [log]);

  return {
    clear,
    enabled: Boolean(log),
    events: log ? log.getEvents() : EMPTY_EVENTS,
    log,
    stats: log?.getStats(),
  };
};
