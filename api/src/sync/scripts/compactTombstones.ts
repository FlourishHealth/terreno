// biome-ignore-all lint/suspicious/noExplicitAny: operates generically across registered sync models
import {DateTime} from "luxon";
import mongoose from "mongoose";
import {logger} from "../../logger";
import {SyncScopeMove} from "../models";
import {getSyncRegistry, type SyncRegistryEntry} from "../registry";

/**
 * C7 tombstone retention maintenance.
 *
 * Tombstones (soft-deleted documents kept so offline clients learn of deletions) and
 * `SyncScopeMove` markers accumulate forever otherwise. This script hard-deletes both
 * once they are older than the model's `retentionDays` (default 90). It is paired with
 * the client-side rule that a cursor older than the snapshot response's
 * `oldestRetainedSeq` triggers a full re-bootstrap of that stream — so compacting
 * tombstones a client has already seen is safe, and a client that missed them recovers
 * by re-bootstrapping rather than silently keeping stale data.
 *
 * Run as a periodic maintenance job (cron), NOT on the request path. Requires an active
 * Mongoose connection.
 */

/** Default retention window when a model does not override `sync.retentionDays`. */
export const DEFAULT_TOMBSTONE_RETENTION_DAYS = 90;

export interface CompactTombstonesResult {
  /** Per-collection counts of hard-deleted tombstones and scope-move markers. */
  byCollection: Record<string, {tombstones: number; markers: number}>;
  /** Total tombstones hard-deleted. */
  totalTombstones: number;
  /** Total scope-move markers hard-deleted. */
  totalMarkers: number;
}

const retentionCutoff = (entry: SyncRegistryEntry): Date => {
  const days = entry.config.retentionDays ?? DEFAULT_TOMBSTONE_RETENTION_DAYS;
  return DateTime.now().minus({days}).toJSDate();
};

/**
 * Compact tombstones and scope-move markers for one registry entry: hard-delete
 * soft-deleted documents whose `updated` (falling back to `created`) predates the
 * retention window, plus scope-move markers older than the window.
 */
export const compactEntryTombstones = async (
  entry: SyncRegistryEntry
): Promise<{tombstones: number; markers: number}> => {
  const cutoff = retentionCutoff(entry);
  const model = mongoose.model(entry.modelName);
  // Hard delete soft-deleted docs older than the cutoff. deleteMany on the raw collection
  // bypasses the syncPlugin guard (which blocks deleteMany on the model) — this is a
  // deliberate maintenance-only escape hatch.
  const tombstoneResult = await model.collection.deleteMany({
    $or: [{updated: {$lt: cutoff}}, {created: {$lt: cutoff}, updated: {$exists: false}}],
    deleted: true,
  });
  const markerResult = await SyncScopeMove.collection.deleteMany({
    collectionTag: entry.collectionTag,
    created: {$lt: cutoff},
  });
  return {
    markers: markerResult.deletedCount ?? 0,
    tombstones: tombstoneResult.deletedCount ?? 0,
  };
};

/** Compact tombstones across every registered sync model. */
export const compactTombstones = async (): Promise<CompactTombstonesResult> => {
  const byCollection: CompactTombstonesResult["byCollection"] = {};
  let totalTombstones = 0;
  let totalMarkers = 0;
  for (const entry of getSyncRegistry()) {
    const counts = await compactEntryTombstones(entry);
    byCollection[entry.collectionTag] = counts;
    totalTombstones += counts.tombstones;
    totalMarkers += counts.markers;
    logger.info("[sync] Compacted tombstones", {
      collection: entry.collectionTag,
      markers: counts.markers,
      tombstones: counts.tombstones,
    });
  }
  return {byCollection, totalMarkers, totalTombstones};
};
