import type {ConflictStore} from "../mutations/conflicts";
import type {Outbox} from "../mutations/outbox";
import type {SyncStore} from "../storage/store";
import type {SyncAckEvent, SyncNackEvent, SyncServerEvent, SyncTransport} from "./types";

export interface ReplayCoordinator {
  /** Send all currently-queued mutations to the server, marking them in flight. */
  replay(): void;
  /** Subscribe to transport ack/nack events; returns an unsubscribe function. */
  start(): () => void;
}

/**
 * Bridges the durable outbox and the transport: replays queued mutations and
 * resolves their server acknowledgements.
 *
 * - ack -> remove from outbox (finalized)
 * - nack(conflict) -> capture a conflict + mark conflicted
 * - nack(auth) -> requeue + report auth-blocked (replay pauses, state preserved)
 * - nack(validation|error) -> mark failed
 */
export const createReplayCoordinator = ({
  store,
  outbox,
  conflicts,
  transport,
  onAuthBlocked,
}: {
  store: SyncStore;
  outbox: Outbox;
  conflicts: ConflictStore;
  transport: SyncTransport;
  onAuthBlocked?: (blocked: boolean) => void;
}): ReplayCoordinator => {
  const replay = (): void => {
    for (const mutation of outbox.list<Record<string, unknown>>({status: "queued"})) {
      outbox.markInFlight({mutationId: mutation.mutationId});
      transport.send({
        args: mutation.args,
        baseVersion: mutation.baseVersion,
        collection: mutation.collection,
        entityId: mutation.entityId,
        mutationId: mutation.mutationId,
        operation: mutation.operation,
        type: "mutation",
      });
    }
  };

  const handleAck = (event: SyncAckEvent): void => {
    const mutation = outbox.get({mutationId: event.mutationId});
    if (!mutation || mutation.status !== "inFlight") {
      return;
    }
    outbox.markAcked({mutationId: event.mutationId});
  };

  const handleNack = (event: SyncNackEvent): void => {
    const mutation = outbox.get<Record<string, unknown>>({mutationId: event.mutationId});
    if (!mutation || mutation.status !== "inFlight") {
      return;
    }

    if (event.reason === "auth") {
      outbox.markQueued({mutationId: event.mutationId});
      onAuthBlocked?.(true);
      return;
    }

    if (event.reason === "conflict") {
      const entityId = mutation.entityId ?? "";
      const local = store.getEntity<Record<string, unknown>>({
        collection: mutation.collection,
        id: entityId,
      });
      conflicts.capture({
        collection: mutation.collection,
        entityId,
        localData: local?.data ?? mutation.args,
        mutationId: event.mutationId,
        serverData: event.serverData ?? {},
      });
      outbox.markConflicted({mutationId: event.mutationId});
      return;
    }

    // validation | error
    outbox.markFailed({mutationId: event.mutationId});
  };

  const handleEvent = (event: SyncServerEvent): void => {
    if (event.type === "sync:ack") {
      handleAck(event);
      return;
    }
    if (event.type === "sync:nack") {
      handleNack(event);
    }
    // sync:delta is handled by the delta applier, not the replay coordinator.
  };

  const start = (): (() => void) => transport.onEvent(handleEvent);

  return {replay, start};
};
