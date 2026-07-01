import type {SyncStore} from "../storage/store";
import type {ConflictStore} from "./conflicts";
import type {Outbox} from "./outbox";

/** Conflict resolution strategy (v1 supports exactly these two). */
export type ConflictStrategy = "useServer" | "keepMine";

export interface ConflictResolver {
  resolve(args: {conflictId: string; strategy: ConflictStrategy}): void;
}

/**
 * Apply a user's conflict resolution choice:
 *
 * - `useServer`: overwrite the local entity with the server's data and discard
 *   the pending mutation that conflicted.
 * - `keepMine`: requeue the conflicting mutation so it replays against the new
 *   server version, keeping the local data.
 */
export const createConflictResolver = ({
  store,
  outbox,
  conflicts,
}: {
  store: SyncStore;
  outbox: Outbox;
  conflicts: ConflictStore;
}): ConflictResolver => {
  const resolve = ({
    conflictId,
    strategy,
  }: {
    conflictId: string;
    strategy: ConflictStrategy;
  }): void => {
    const conflict = conflicts.get<Record<string, unknown>>({conflictId});
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    if (strategy === "useServer") {
      store.upsertEntity({
        collection: conflict.collection,
        data: conflict.serverData,
        id: conflict.entityId,
        version: conflict.serverVersion,
      });
      if (outbox.get({mutationId: conflict.mutationId})) {
        outbox.remove({mutationId: conflict.mutationId});
      }
      conflicts.remove({conflictId});
      return;
    }

    // keepMine: retry the local mutation against the latest server state.
    if (outbox.get({mutationId: conflict.mutationId})) {
      outbox.requeue({mutationId: conflict.mutationId});
    }
    conflicts.remove({conflictId});
  };

  return {resolve};
};
