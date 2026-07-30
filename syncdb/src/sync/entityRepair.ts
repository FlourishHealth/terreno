import type {SyncStore} from "../storage/store";
import type {SyncSnapshotEntity} from "../types";
import type {HttpChannel} from "./httpChannel";

/** Max ids per repair fetch (matches server cap). */
export const MAX_REPAIR_FETCH_IDS = 100;

/**
 * Apply canonical server state after a pending mutation resolved without a
 * server ack. Bypasses pending-protection — the outbox row is terminal and
 * `pendingMutationId` was cleared before repair runs. No-ops (and keeps the
 * needs-repair mark) when the entity is still pending or conflicted so a
 * reconcile-time repair pass cannot clobber optimistic local state.
 */
export const applyRepairedEntity = ({
  store,
  collection,
  stream,
  entity,
}: {
  store: SyncStore;
  collection: string;
  stream: string;
  entity: SyncSnapshotEntity;
}): boolean => {
  const existing = store.getEntity({collection, id: entity.id});
  // Still owned by an unresolved outbox mutation (including conflicted): the
  // optimistic row must stay until the user resolves. Leave the needs-repair
  // mark so a later pass (after release) can apply canonical server state.
  if (existing?.pendingMutationId) {
    return false;
  }
  store.upsertEntity({
    collection,
    data: entity.data,
    deleted: entity.deleted,
    id: entity.id,
    pendingMutationId: "",
    seq: entity.seq,
    stream,
  });
  store.clearNeedsRepair({collection, entityId: entity.id});
  return true;
};

/**
 * Fetch current server state for marked entities and overwrite local rows.
 * No-ops when the channel is unavailable or nothing is marked.
 *
 * Entities that still carry a `pendingMutationId` are left marked and
 * untouched — reconcile marks them when a snapshot page is skipped for
 * pending protection, but repair must wait until the outbox row is terminal
 * (see {@link applyRepairedEntity}).
 *
 * Every other requested id is unmarked, whether or not the server returned it.
 * An id the server declines to return (hard-deleted, permission-filtered, or a
 * client-minted id whose create never landed) has no server state to repair to,
 * so keeping the mark would make every later reconcile re-fetch it forever —
 * holding `isSyncing` high and growing the request set without bound.
 */
export const repairMarkedEntities = async ({
  store,
  channel,
  collection,
  entityIds,
}: {
  store: SyncStore;
  channel: Pick<HttpChannel, "fetchEntities">;
  collection: string;
  entityIds?: string[];
}): Promise<number> => {
  // Snapshot the marks once: resolving each response entity's stream against a live
  // table scan is O(marks) per entity, which dominates a large repair pass.
  const streamByEntityId = new Map<string, string>();
  for (const row of store.listNeedsRepair()) {
    if (row.collection === collection) {
      streamByEntityId.set(row.entityId, row.stream);
    }
  }

  const targets = entityIds ?? [...streamByEntityId.keys()];
  // Drop still-pending ids from this pass entirely (do not fetch, do not clear
  // their marks). Reconcile ends with repairAllMarkedEntities; without this
  // filter a reconnect would overwrite optimistic conflict state with server.
  const ids = targets.filter((id) => {
    if (!streamByEntityId.has(id)) {
      return false;
    }
    const existing = store.getEntity({collection, id});
    return !existing?.pendingMutationId;
  });
  if (ids.length === 0) {
    return 0;
  }

  let repaired = 0;
  for (let i = 0; i < ids.length; i += MAX_REPAIR_FETCH_IDS) {
    const chunk = ids.slice(i, i + MAX_REPAIR_FETCH_IDS);
    const response = await channel.fetchEntities({collection, ids: chunk});
    const returned = new Set<string>();
    for (const entity of response.entities) {
      returned.add(entity.id);
      const stream = streamByEntityId.get(entity.id) ?? "";
      if (!stream) {
        continue;
      }
      if (applyRepairedEntity({collection, entity, store, stream})) {
        repaired += 1;
      }
    }
    for (const id of chunk) {
      if (!returned.has(id)) {
        store.clearNeedsRepair({collection, entityId: id});
      }
    }
  }
  return repaired;
};
