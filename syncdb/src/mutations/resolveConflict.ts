import type {SyncStore} from "../storage/store";
import type {ConflictResolutionStrategy} from "../types";
import {deleteConflict, getConflict} from "./conflicts";
import type {Outbox} from "./outbox";

/**
 * Apply the user's resolution choice to a recorded conflict:
 *
 * - `"useServer"`: overwrite the local entity with the canonical server data
 *   and seq, clear its `pendingMutationId`, and delete the conflict row. The
 *   outbox mutation stays `conflicted` (a terminal state — it never replays).
 * - `"keepMine"`: requeue the conflicted mutation under a FRESH mutationId
 *   (the original id is burned on the server's idempotency ledger, which would
 *   replay the recorded conflict nack forever) with `baseVersion` set to the
 *   server seq recorded on the conflict so the retry passes the LWW check, and
 *   delete the conflict row. The entity keeps its optimistic local data and
 *   its `pendingMutationId` is re-pointed at the retry so the retry's ack can
 *   release it.
 */
export const resolveConflict = ({
  store,
  outbox,
  mutationId,
  strategy,
}: {
  store: SyncStore;
  outbox: Outbox;
  mutationId: string;
  strategy: ConflictResolutionStrategy;
}): void => {
  const conflict = getConflict({mutationId, store});
  if (!conflict) {
    throw new Error(`Conflict not found: ${mutationId}`);
  }

  if (strategy === "useServer") {
    let serverData: unknown = null;
    try {
      serverData = JSON.parse(conflict.serverData);
    } catch {
      serverData = null;
    }
    store.upsertEntity({
      collection: conflict.collection,
      data: serverData,
      id: conflict.entityId,
      pendingMutationId: "",
      seq: conflict.serverSeq,
    });
    deleteConflict({mutationId, store});
    return;
  }

  // keepMine: replay the local mutation against the latest server version,
  // under a fresh mutationId (see requeue).
  const retry = outbox.requeue({baseVersion: conflict.serverSeq, mutationId});
  const entity = store.getEntity({collection: conflict.collection, id: conflict.entityId});
  if (entity?.pendingMutationId === mutationId) {
    store.upsertEntity({
      collection: conflict.collection,
      data: entity.data,
      id: conflict.entityId,
      pendingMutationId: retry.mutationId,
    });
  }
  deleteConflict({mutationId, store});
};
