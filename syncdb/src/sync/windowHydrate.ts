import type {SyncStore} from "../storage/store";
import {MAX_REPAIR_FETCH_IDS} from "./entityRepair";
import type {HttpChannel} from "./httpChannel";

/** Stream key window subscribers join (`{collection}|admin`). */
const adminWindowStream = (collection: string): string => `${collection}|admin`;

export interface HydrateWindowEntitiesArgs {
  store: SyncStore;
  channel: Pick<HttpChannel, "fetchEntities">;
  collection: string;
  ids: string[];
  /**
   * Optional REST membership payloads keyed by id. Those rows upsert immediately
   * for fast UI; every requested id is still fetched from `GET /sync/entities`
   * before this call resolves so seq/deleted metadata is canonical.
   */
  restRows?: Record<string, unknown>;
}

export interface HydrateWindowEntitiesResult {
  hydratedIds: string[];
}

/**
 * Upsert a window of known ids into TinyBase. REST rows render immediately;
 * canonical seq/deleted metadata comes from `GET /sync/entities` for every
 * requested id before this resolves. Server ids that `/sync/entities` does not
 * return are ignored (no empty rows) unless a REST row already landed.
 */
export const hydrateWindowEntities = async ({
  store,
  channel,
  collection,
  ids,
  restRows,
}: HydrateWindowEntitiesArgs): Promise<HydrateWindowEntitiesResult> => {
  const uniqueIds = [...new Set(ids.filter((id) => id.length > 0))];
  if (uniqueIds.length === 0) {
    return {hydratedIds: []};
  }

  const stream = adminWindowStream(collection);
  const hydrated = new Set<string>();

  for (const id of uniqueIds) {
    const restData = restRows?.[id];
    if (restData === undefined) {
      continue;
    }
    const existing = store.getEntity({collection, id});
    if (existing?.pendingMutationId) {
      continue;
    }
    store.upsertEntity({
      collection,
      data: restData,
      id,
      stream,
    });
    hydrated.add(id);
  }

  for (let i = 0; i < uniqueIds.length; i += MAX_REPAIR_FETCH_IDS) {
    const chunk = uniqueIds.slice(i, i + MAX_REPAIR_FETCH_IDS);
    const response = await channel.fetchEntities({collection, ids: chunk});
    for (const entity of response.entities) {
      if (!uniqueIds.includes(entity.id)) {
        continue;
      }
      const existing = store.getEntity({collection, id: entity.id});
      if (existing?.pendingMutationId) {
        continue;
      }
      const restData = restRows?.[entity.id];
      store.upsertEntity({
        collection,
        data: restData !== undefined ? (existing?.data ?? restData) : entity.data,
        deleted: entity.deleted,
        id: entity.id,
        pendingMutationId: "",
        seq: entity.seq,
        stream,
      });
      hydrated.add(entity.id);
    }
  }

  return {hydratedIds: [...hydrated]};
};
