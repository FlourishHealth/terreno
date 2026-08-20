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

import {useCallback, useRef, useSyncExternalStore} from "react";

import type {SyncDebugEvent, SyncDebugLog, SyncDebugStats} from "../debug/debugLog";
import {listConflicts} from "../mutations/conflicts";
import {CONFLICTS_TABLE, CURSORS_TABLE, OUTBOX_TABLE} from "../storage/types";
import type {ConflictResolutionStrategy, SyncConflict, SyncStatus} from "../types";
import {useSyncDbClient} from "./provider";

/**
 * `useSyncExternalStore` wrapper that recomputes the selected value only when the
 * underlying store actually changes, giving selectors returning fresh
 * objects/arrays a stable identity across unrelated renders without ever causing
 * render loops.
 *
 * React calls `getSnapshot` on EVERY render (not only when the store changes) to
 * check for tearing. The previous implementation re-ran `select()` and then
 * `JSON.stringify`'d the entire result on every one of those calls — O(n) work
 * (decode + filter + sort + serialize the whole collection) on every keystroke
 * or unrelated parent re-render, which dominates once a collection grows to
 * thousands of rows. Instead we bump a monotonic revision only when a change is
 * routed through our subscribe wrapper, and cache the computed value against
 * that revision (and the selector identity, so a changed collection/id
 * recomputes immediately rather than returning a stale snapshot). Unrelated
 * re-renders then return the cached value in O(1) and never serialize.
 */
const useCachedExternalStore = <T>(
  subscribe: (onChange: () => void) => () => void,
  select: () => T,
  /**
   * Optional structural equality over consecutive selections. When provided and
   * a real store change produces an equal value, the PREVIOUS reference is kept
   * so downstream consumers do not re-render. This is what lets `useEntityIds`
   * stay referentially stable across field-only updates (which change a row's
   * data but not the id membership/order), so toggling one entity re-renders
   * only that entity's own subscribers, never the list container.
   */
  areEqual?: (previous: T, next: T) => boolean
): T => {
  const revisionRef = useRef(0);
  const cacheRef = useRef<{revision: number; select: () => T; value: T} | null>(null);

  const wrappedSubscribe = useCallback(
    (onChange: () => void): (() => void) =>
      subscribe(() => {
        revisionRef.current += 1;
        onChange();
      }),
    [subscribe]
  );

  const getSnapshot = useCallback((): T => {
    const revision = revisionRef.current;
    const cached = cacheRef.current;
    if (cached && cached.select === select && cached.revision === revision) {
      // Neither the store nor the selector changed since the last computation →
      // reuse in O(1) (the common case: unrelated re-renders such as a keystroke
      // in a sibling input).
      return cached.value;
    }
    // Either the store changed or the selector did (a new collection/id, or
    // changed query options — see useQuery). Recompute, but keep the previous
    // reference when an equality check says the result is unchanged (e.g. a
    // field update that did not alter id membership/order), which is also what
    // keeps `useSyncExternalStore` from re-rendering on every recomputation.
    const next = select();
    if (cached && areEqual?.(cached.value, next)) {
      cacheRef.current = {revision, select, value: cached.value};
      return cached.value;
    }
    cacheRef.current = {revision, select, value: next};
    return next;
  }, [select, areEqual]);

  return useSyncExternalStore(wrappedSubscribe, getSnapshot, getSnapshot);
};

/** Referential-stability helper: true when two id lists are element-wise equal. */
const idsEqual = (previous: string[], next: string[]): boolean => {
  if (previous === next) {
    return true;
  }
  if (previous.length !== next.length) {
    return false;
  }
  for (let index = 0; index < previous.length; index += 1) {
    if (previous[index] !== next[index]) {
      return false;
    }
  }
  return true;
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
 * Subscribe to a collection; returns the entities' decoded data and re-renders
 * on any table change. Tombstones are excluded unless `includeDeleted` is set;
 * filter and sort run in JS.
 *
 * `filter`/`sort`/`includeDeleted` are part of the selection identity (compared
 * by reference), so a state-driven filter change is reflected on the very next
 * render without waiting for a store write. The flip side is that a filter/sort
 * passed as a fresh inline closure every render invalidates the snapshot cache
 * every render — wrap them in `useCallback` (or hoist them) when the collection
 * is large enough for the decode/filter/sort pass to matter.
 */
export const useQuery = <TData = Record<string, unknown>>(
  collection: string,
  options?: UseQueryOptions<TData>
): TData[] => {
  const client = useSyncDbClient();
  const {filter, includeDeleted, sort} = options ?? {};

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
    const entities = client.store.listEntities<TData>({collection, includeDeleted});
    // E4: a corrupt/legacy row decodes to `data: null` (store.ts's decodeData
    // swallows JSON.parse failures and returns null rather than throwing) —
    // skip it here rather than letting it crash list consumers that assume
    // every row's data matches TData (e.g. destructuring a field off it).
    let results = entities.filter((entity) => entity.data !== null).map((entity) => entity.data);
    if (filter) {
      results = results.filter(filter);
    }
    if (sort) {
      results = [...results].sort(sort);
    }
    return results;
  }, [client, collection, filter, includeDeleted, sort]);

  return useCachedExternalStore(subscribe, select);
};

/**
 * Subscribe to a collection but return only the (ordered) entity ids, with a
 * referentially STABLE array that changes identity only when the id membership
 * or order actually changes — not when a field of an existing row changes.
 *
 * Pair this with per-row `useEntity(collection, id)` to build large lists that
 * stay fast without virtualization: rendering `ids.map(id => <Row id={id} />)`
 * means a field update (e.g. toggling one row) re-renders ONLY that row's
 * `useEntity` subscriber, and the list container re-renders only when rows are
 * added/removed/reordered. `filter`/`sort` run in JS over the decoded data and,
 * as in `useQuery`, are part of the selection identity — a changed filter is
 * reflected on the next render, and memoizing inline callbacks keeps the
 * recomputation to store changes only. Either way the returned array keeps its
 * identity whenever the resulting ids are unchanged.
 */
export const useEntityIds = <TData = Record<string, unknown>>(
  collection: string,
  options?: UseQueryOptions<TData>
): string[] => {
  const client = useSyncDbClient();
  const {filter, includeDeleted, sort} = options ?? {};

  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const listenerId = client.store.raw.addTableListener(collection, onChange);
      return () => {
        client.store.raw.delListener(listenerId);
      };
    },
    [client, collection]
  );

  const select = useCallback((): string[] => {
    const entities = client.store.listEntities<TData>({collection, includeDeleted});
    let results = entities.filter((entity) => entity.data !== null);
    if (filter) {
      results = results.filter((entity) => filter(entity.data));
    }
    if (sort) {
      results = [...results].sort((a, b) => sort(a.data, b.data));
    }
    return results.map((entity) => entity.id);
  }, [client, collection, filter, includeDeleted, sort]);

  return useCachedExternalStore(subscribe, select, idsEqual);
};

export interface UseMutateResult {
  /** Optimistically create an entity; returns the generated ids. */
  create: (args: {
    data: Record<string, unknown>;
    maxAttempts?: number;
  }) => {mutationId: string; id: string};
  /** Optimistically merge fields into an existing entity. */
  update: (args: {
    id: string;
    data: Record<string, unknown>;
    maxAttempts?: number;
  }) => {mutationId: string; id: string};
  /** Optimistically soft-delete an entity. */
  remove: (args: {
    id: string;
    maxAttempts?: number;
  }) => {mutationId: string; id: string};
}

/**
 * Collection-scoped mutation helpers wrapping `client.mutate`: each applies
 * locally, enqueues a durable outbox mutation, and kicks off replay.
 */
export const useMutate = (collection: string): UseMutateResult => {
  const client = useSyncDbClient();

  const create = useCallback(
    (args: {
      data: Record<string, unknown>;
      maxAttempts?: number;
    }): {mutationId: string; id: string} =>
      client.mutate({
        collection,
        data: args.data,
        maxAttempts: args.maxAttempts,
        operation: "create",
      }),
    [client, collection]
  );

  const update = useCallback(
    (args: {
      id: string;
      data: Record<string, unknown>;
      maxAttempts?: number;
    }): {mutationId: string; id: string} =>
      client.mutate({
        collection,
        data: args.data,
        id: args.id,
        maxAttempts: args.maxAttempts,
        operation: "update",
      }),
    [client, collection]
  );

  const remove = useCallback(
    (args: {id: string; maxAttempts?: number}): {mutationId: string; id: string} =>
      client.mutate({
        collection,
        id: args.id,
        maxAttempts: args.maxAttempts,
        operation: "delete",
      }),
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
