import type {SyncStore} from "../storage/store";
import type {ConflictResolutionStrategy} from "../types";
import {deleteConflict, getConflict} from "./conflicts";
import type {Outbox} from "./outbox";

/**
 * Apply the user's resolution choice to a recorded conflict:
 *
 * - `"useServer"`: overwrite the local entity with the canonical server data
 *   and seq, clear its `pendingMutationId`, delete the conflict row, and
 *   discard the spent conflicted outbox row (so startup recovery cannot
 *   resurrect a phantom conflict). The local row's deleted flag follows the
 *   server side: a tombstone when the server deleted the document (rather than a
 *   null-data ghost row), and a resurrection when the server still has it and
 *   the local row was a tombstone (Task 9.12).
 * - `"keepMine"`: requeue the conflicted mutation under a FRESH mutationId
 *   (the original id is burned on the server's idempotency ledger, which would
 *   replay the recorded conflict nack forever) with `baseVersion` set to the
 *   server seq recorded on the conflict so the retry passes the LWW check, and
 *   delete the conflict row. The entity keeps its optimistic local data and
 *   its `pendingMutationId` is re-pointed at the retry so the retry's ack can
 *   release it.
 *
 * If a prior bug left the outbox row as `queued`/`inFlight` while the
 * `_conflicts` row still existed, keepMine repairs that first so resolve does
 * not throw `Illegal outbox transition "queued" → "queued"`.
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
    // Task 9.12: the server side of the conflict can be a tombstone (deleted,
    // hard-deleted, or moved out of this client's scope). Writing its null data
    // over a live row would leave a ghost entity that lists and renders forever
    // — the resolution is a tombstone. `serverDeleted` is authoritative when the
    // server sends it; otherwise null data AT A REAL SEQ means the same thing.
    // Null data at seq 0 does NOT: that is the startup-recovery shape for a
    // conflict whose nack was never seen, i.e. server state unknown, and
    // deleting local data on it would be silent data loss.
    const serverDeleted =
      conflict.serverDeleted === true || (serverData === null && conflict.serverSeq > 0);
    // The mirror image matters too: when the server DOES have the document, a
    // local tombstone (a delete that lost the conflict) must be resurrected, or
    // the live server row stays invisible locally. `undefined` leaves the local
    // flag alone, which is the right answer only for the seq-0 "unknown" shape.
    let deleted: boolean | undefined;
    if (serverDeleted) {
      deleted = true;
    } else if (serverData !== null) {
      deleted = false;
    }
    store.upsertEntity({
      collection: conflict.collection,
      data: serverData,
      deleted,
      id: conflict.entityId,
      pendingMutationId: "",
      seq: conflict.serverSeq,
    });
    store.clearNeedsRepair({collection: conflict.collection, entityId: conflict.entityId});
    deleteConflict({mutationId, store});
    // Drop the spent outbox row if it is still around. Leaving it as
    // `conflicted` lets recoverStartupState rewrite a phantom `_conflicts`
    // row on the next start(); a corrupt `queued` row for this burned id
    // must not replay either.
    if (outbox.getMutation({mutationId})) {
      outbox.discard({mutationId});
    }
    return;
  }

  // keepMine: replay the local mutation against the latest server version,
  // under a fresh mutationId (see requeue).
  const existing = outbox.getMutation({mutationId});
  if (!existing) {
    // Conflict row without an outbox row — nothing to retry; just clear UI.
    deleteConflict({mutationId, store});
    return;
  }
  if (existing.status !== "conflicted") {
    // Repair corrupt/racing state (e.g. markQueued-from-conflicted) so requeue
    // can mint a fresh id for the burned mutationId.
    outbox.restoreConflicted({mutationId});
  }
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
