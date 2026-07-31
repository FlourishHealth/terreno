// biome-ignore-all lint/suspicious/noExplicitAny: operates generically across registered sync models
import {DateTime} from "luxon";
import mongoose from "mongoose";
import {logger} from "../../logger";
import {recordCompactedThroughSeq, SyncScopeMove} from "../models";
import {getSyncRegistry, type SyncRegistryEntry} from "../registry";
import {getScopeField, resolveStreamForDoc} from "../streams";

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
 *
 * Task 9.15: the rows are READ before they are deleted so the highest reaped seq per
 * stream can be recorded as that stream's `compactedThroughSeq` watermark. That watermark
 * is the snapshot's `oldestRetainedSeq`, and it is the only signal a client has that its
 * cursor sits below a deletion it can no longer be told about. Deleting without raising it
 * silently strands the client on stale data. This is also why `SyncScopeMove` no longer
 * carries a TTL index: an expiry that fires outside this function reaps rows with no
 * watermark update and ignores the model's `retentionDays`.
 */
export const compactEntryTombstones = async (
  entry: SyncRegistryEntry
): Promise<{tombstones: number; markers: number}> => {
  const cutoff = retentionCutoff(entry);
  const model = mongoose.model(entry.modelName);
  const scopeField = getScopeField(entry.config.scope);
  const tombstoneFilter = {
    $or: [{updated: {$lt: cutoff}}, {created: {$lt: cutoff}, updated: {$exists: false}}],
    deleted: true,
  };
  const markerFilter = {collectionTag: entry.collectionTag, created: {$lt: cutoff}};

  /** stream key -> highest seq being reaped on that stream. */
  const watermarks = new Map<string, number>();
  const raiseWatermark = (stream: string, seq: unknown): void => {
    if (typeof seq !== "number" || seq <= 0) {
      return;
    }
    if (seq > (watermarks.get(stream) ?? 0)) {
      watermarks.set(stream, seq);
    }
  };

  // A custom scope resolver may read any field, so it needs whole documents; broadcast and
  // field-based scopes only need the seq (plus the scope field) to resolve the stream.
  const isCustomScope = typeof entry.config.scope === "function";
  const projection = scopeField
    ? {_id: 1, _syncSeq: 1, [scopeField]: 1}
    : isCustomScope
      ? undefined
      : {_id: 1, _syncSeq: 1};
  const doomedTombstones = await model.collection
    .find(tombstoneFilter, projection ? {projection} : {})
    .toArray();
  for (const row of doomedTombstones) {
    raiseWatermark(
      resolveStreamForDoc({
        collectionTag: entry.collectionTag,
        doc: row as Record<string, unknown>,
        scope: entry.config.scope,
      }),
      (row as {_syncSeq?: unknown})._syncSeq
    );
  }

  const doomedMarkers = await SyncScopeMove.collection
    .find(markerFilter, {projection: {_id: 1, fromStream: 1, seq: 1}})
    .toArray();
  for (const marker of doomedMarkers) {
    raiseWatermark(
      String((marker as {fromStream?: unknown}).fromStream),
      (marker as {seq?: unknown}).seq
    );
  }

  // Hard delete soft-deleted docs older than the cutoff. deleteMany on the raw collection
  // bypasses the syncPlugin guard (which blocks deleteMany on the model) — this is a
  // deliberate maintenance-only escape hatch.
  const tombstoneResult = await model.collection.deleteMany(tombstoneFilter);
  const markerResult = await SyncScopeMove.collection.deleteMany(markerFilter);

  // Raise the watermarks AFTER the deletes: a watermark that runs ahead of the actual
  // deletion would force re-bootstraps for data still perfectly readable.
  for (const [stream, seq] of watermarks) {
    await recordCompactedThroughSeq({seq, stream});
  }

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
