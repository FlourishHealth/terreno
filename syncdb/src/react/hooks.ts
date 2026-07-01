import {useCallback, useRef, useSyncExternalStore} from "react";
import type {ConflictStrategy} from "../mutations/resolveConflict";
import {entityKey} from "../storage/store";
import {
  type LocalEntityRecord,
  type OutboxOperation,
  SYNC_TABLES,
  type SyncConflict,
} from "../storage/types";
import type {SyncStatus} from "../types";
import {useSyncDbClient} from "./provider";

/**
 * useSyncExternalStore wrapper that caches the selected value by structural
 * equality so selectors returning fresh objects don't cause render loops.
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

/** Subscribe to a single entity; re-renders when it changes. */
export const useEntity = <TData = Record<string, unknown>>({
  collection,
  id,
}: {
  collection: string;
  id: string;
}): LocalEntityRecord<TData> | undefined => {
  const client = useSyncDbClient();
  const key = entityKey({collection, id});

  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const listenerId = client.store.raw.addRowListener(SYNC_TABLES.entities, key, onChange);
      return () => client.store.raw.delListener(listenerId);
    },
    [client, key]
  );

  const select = useCallback(
    (): LocalEntityRecord<TData> | undefined => client.store.getEntity<TData>({collection, id}),
    [client, collection, id]
  );

  return useCachedExternalStore(subscribe, select);
};

/** Subscribe to all (non-deleted) entities in a collection. */
export const useQuery = <TData = Record<string, unknown>>({
  collection,
  includeDeleted,
}: {
  collection: string;
  includeDeleted?: boolean;
}): LocalEntityRecord<TData>[] => {
  const client = useSyncDbClient();

  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const listenerId = client.store.raw.addTableListener(SYNC_TABLES.entities, onChange);
      return () => client.store.raw.delListener(listenerId);
    },
    [client]
  );

  const select = useCallback(
    (): LocalEntityRecord<TData>[] =>
      client.store.getCollectionEntities<TData>({collection, includeDeleted}),
    [client, collection, includeDeleted]
  );

  return useCachedExternalStore(subscribe, select);
};

/** Aggregate sync status; re-renders on status, queue, or conflict changes. */
export const useSyncStatus = (): SyncStatus => {
  const client = useSyncDbClient();

  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const unsubStatus = client.addStatusListener(onChange);
      const outboxListener = client.store.raw.addTableListener(SYNC_TABLES.outbox, onChange);
      const conflictListener = client.store.raw.addTableListener(SYNC_TABLES.conflicts, onChange);
      return () => {
        unsubStatus();
        client.store.raw.delListener(outboxListener);
        client.store.raw.delListener(conflictListener);
      };
    },
    [client]
  );

  const select = useCallback((): SyncStatus => client.getSyncStatus(), [client]);

  return useCachedExternalStore(subscribe, select);
};

/** Subscribe to unresolved conflicts and expose a resolver. */
export const useConflicts = <TData = Record<string, unknown>>(): {
  conflicts: SyncConflict<TData>[];
  resolve: (args: {conflictId: string; strategy: ConflictStrategy}) => void;
} => {
  const client = useSyncDbClient();

  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const listenerId = client.store.raw.addTableListener(SYNC_TABLES.conflicts, onChange);
      return () => client.store.raw.delListener(listenerId);
    },
    [client]
  );

  const select = useCallback((): SyncConflict<TData>[] => client.conflicts.list<TData>(), [client]);

  const conflicts = useCachedExternalStore(subscribe, select);
  const resolve = useCallback(
    (args: {conflictId: string; strategy: ConflictStrategy}): void => client.resolveConflict(args),
    [client]
  );

  return {conflicts, resolve};
};

export interface MutationInput<TData> {
  id: string;
  data?: TData;
  userId?: string;
  baseVersion?: string;
}

/**
 * Optimistic local-first mutations for a collection: each writes to the local
 * store immediately, enqueues a durable outbox mutation, and triggers replay.
 */
export const useSyncMutations = <TData = Record<string, unknown>>({
  collection,
}: {
  collection: string;
}): {
  create: (input: MutationInput<TData>) => void;
  update: (input: MutationInput<TData>) => void;
  remove: (input: {id: string; userId?: string; baseVersion?: string}) => void;
} => {
  const client = useSyncDbClient();

  const enqueueAndReplay = useCallback(
    (args: {
      operation: OutboxOperation;
      id: string;
      data?: TData;
      userId?: string;
      baseVersion?: string;
    }): void => {
      client.outbox.enqueue({
        args: (args.data ?? {}) as Record<string, unknown>,
        baseVersion: args.baseVersion,
        collection,
        entityId: args.id,
        operation: args.operation,
        userId: args.userId,
      });
      client.replayOutbox();
    },
    [client, collection]
  );

  const create = useCallback(
    (input: MutationInput<TData>): void => {
      client.store.upsertEntity({collection, data: input.data ?? {}, id: input.id});
      enqueueAndReplay({...input, operation: "create"});
    },
    [client, collection, enqueueAndReplay]
  );

  const update = useCallback(
    (input: MutationInput<TData>): void => {
      // Capture the current entity version (before the optimistic write) so the
      // mutation carries baseVersion for server-side optimistic concurrency, and
      // preserve it on the optimistic upsert so a rapid second edit (before the
      // first ack) still carries the same baseVersion.
      const baseVersion =
        input.baseVersion ?? client.store.getEntity({collection, id: input.id})?.version;
      client.store.upsertEntity({
        collection,
        data: input.data ?? {},
        id: input.id,
        version: baseVersion,
      });
      enqueueAndReplay({...input, baseVersion, operation: "update"});
    },
    [client, collection, enqueueAndReplay]
  );

  const remove = useCallback(
    (input: {id: string; userId?: string; baseVersion?: string}): void => {
      const baseVersion =
        input.baseVersion ?? client.store.getEntity({collection, id: input.id})?.version;
      client.store.deleteEntity({collection, id: input.id});
      enqueueAndReplay({...input, baseVersion, operation: "delete"});
    },
    [client, collection, enqueueAndReplay]
  );

  return {create, remove, update};
};
