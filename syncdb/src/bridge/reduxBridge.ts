import type {SyncDbClient} from "../client";
import type {OutboxOperation} from "../storage/types";
import {SYNC_TABLES} from "../storage/types";
import type {SyncStatus} from "../types";

/** Action type dispatched whenever the syncdb status changes. */
export const SYNCDB_STATUS_CHANGED = "syncdb/statusChanged" as const;

export interface SyncDbStatusAction {
  type: typeof SYNCDB_STATUS_CHANGED;
  payload: SyncStatus;
}

export interface SyncDbBridgeState {
  status: SyncStatus;
}

/** Action creator for a status change. */
export const syncDbStatusChanged = (status: SyncStatus): SyncDbStatusAction => ({
  payload: status,
  type: SYNCDB_STATUS_CHANGED,
});

/** Select the mirrored syncdb status from a Redux state tree (`state.syncdb`). */
export const selectSyncStatus = (state: {syncdb: SyncDbBridgeState}): SyncStatus =>
  state.syncdb.status;

interface MutationDispatchInput {
  id: string;
  data?: Record<string, unknown>;
  userId?: string;
  baseVersion?: string;
}

export interface SyncDbBridge {
  /** Redux-compatible reducer mirroring sync status under `state.syncdb`. */
  reducer: (
    state: SyncDbBridgeState | undefined,
    action: {type: string; payload?: SyncStatus}
  ) => SyncDbBridgeState;
  /** Mirror client status into a Redux store; returns an unsubscribe function. */
  connect: (args: {dispatch: (action: SyncDbStatusAction) => void}) => () => void;
  /** Optimistic mutation dispatchers for Redux thunks/components. */
  mutations: (args: {collection: string}) => {
    create: (input: MutationDispatchInput) => void;
    update: (input: MutationDispatchInput) => void;
    remove: (input: {id: string; userId?: string; baseVersion?: string}) => void;
  };
}

/**
 * Optional bridge for Redux apps migrating from `@terreno/rtk`. The local-first
 * source of truth remains the syncdb store; this mirrors aggregate sync status
 * into Redux (for existing selectors/UI) and offers dispatchable mutations.
 */
export const createSyncDbBridge = ({client}: {client: SyncDbClient}): SyncDbBridge => {
  const reducer = (
    state: SyncDbBridgeState | undefined,
    action: {type: string; payload?: SyncStatus}
  ): SyncDbBridgeState => {
    const current = state ?? {status: client.getSyncStatus()};
    if (action.type === SYNCDB_STATUS_CHANGED && action.payload) {
      return {status: action.payload};
    }
    return current;
  };

  const connect = ({dispatch}: {dispatch: (action: SyncDbStatusAction) => void}): (() => void) => {
    const push = (): void => dispatch(syncDbStatusChanged(client.getSyncStatus()));
    const unsubStatus = client.addStatusListener(() => push());
    const outboxListener = client.store.raw.addTableListener(SYNC_TABLES.outbox, push);
    const conflictListener = client.store.raw.addTableListener(SYNC_TABLES.conflicts, push);
    return () => {
      unsubStatus();
      client.store.raw.delListener(outboxListener);
      client.store.raw.delListener(conflictListener);
    };
  };

  const mutations = ({collection}: {collection: string}) => {
    const enqueueAndReplay = (args: {
      operation: OutboxOperation;
      input: MutationDispatchInput;
    }): void => {
      client.outbox.enqueue({
        args: args.input.data ?? {},
        baseVersion: args.input.baseVersion,
        collection,
        entityId: args.input.id,
        operation: args.operation,
        userId: args.input.userId,
      });
      client.replayOutbox();
    };

    return {
      create: (input: MutationDispatchInput): void => {
        client.store.upsertEntity({collection, data: input.data ?? {}, id: input.id});
        enqueueAndReplay({input, operation: "create"});
      },
      remove: (input: {id: string; userId?: string; baseVersion?: string}): void => {
        client.store.deleteEntity({collection, id: input.id});
        enqueueAndReplay({input, operation: "delete"});
      },
      update: (input: MutationDispatchInput): void => {
        client.store.upsertEntity({collection, data: input.data ?? {}, id: input.id});
        enqueueAndReplay({input, operation: "update"});
      },
    };
  };

  return {connect, mutations, reducer};
};
