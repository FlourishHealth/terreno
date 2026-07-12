import crypto from "node:crypto";
import mongoose, {type ClientSession, type Model, Schema} from "mongoose";

/**
 * Mongoose models backing the SyncDB protocol: the per-stream monotonic counter
 * and the per-user encryption key material.
 */

/** An uncommitted seq claim recorded on the counter's in-flight registry (C1). */
export interface SyncPendingClaim {
  /** The claimed seq (or, for a batch, one entry per claimed seq). */
  seq: number;
  /** When the claim was registered; a claim older than the lease is reclaimable. */
  claimedAt: Date;
}

export interface SyncCounterDocument {
  _id: mongoose.Types.ObjectId;
  stream: string;
  seq: number;
  /**
   * C1: seqs claimed but not yet confirmed committed. The stable frontier is
   * `min(pending.seq) - 1`, or `seq` (the head) when empty, so a cursor never
   * advances past a seq whose owning write has not yet landed.
   */
  pending: SyncPendingClaim[];
}

/**
 * C1: a `pending` claim older than this is treated as abandoned (the writer
 * crashed between claiming and confirming) and excluded from the frontier — a
 * crashed writer must never freeze the frontier forever. Default 60s.
 */
export const PENDING_CLAIM_LEASE_MS = 60 * 1_000;

const syncPendingClaimSchema = new Schema<SyncPendingClaim>(
  {
    claimedAt: {
      default: () => new Date(),
      description: "When this seq was claimed; a claim older than PENDING_CLAIM_LEASE_MS is stale",
      type: Date,
    },
    seq: {
      description: "A claimed-but-uncommitted sequence number",
      required: true,
      type: Number,
    },
  },
  {_id: false}
);

const syncCounterSchema = new Schema<SyncCounterDocument>(
  {
    pending: {
      default: [],
      description:
        "C1 in-flight registry: seqs claimed but not yet confirmed committed; the stable " +
        "frontier is min(pending.seq) - 1 (or the head when empty)",
      type: [syncPendingClaimSchema],
    },
    seq: {
      default: 0,
      description: "The last sequence number claimed for this stream",
      type: Number,
    },
    stream: {
      description: "Stream key this counter belongs to (e.g. 'todos|owner:123')",
      required: true,
      type: String,
      unique: true,
    },
  },
  // Consumer apps run checkModelsStrict() at startup; framework models must comply.
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

export const SyncCounter: Model<SyncCounterDocument> =
  (mongoose.models.SyncCounter as Model<SyncCounterDocument>) ??
  mongoose.model<SyncCounterDocument>("SyncCounter", syncCounterSchema);

/**
 * Result of a seq claim: the last seq claimed (range [lastSeq - count + 1, lastSeq])
 * and whether the claim registered a pending entry that a later `confirmSyncSeqs`
 * must clear. A session-backed claim skips the pending registry entirely (the write
 * and the `$inc` commit atomically), so `registered` is false and no confirm is due.
 */
export interface SyncSeqClaim {
  /** The last (highest) seq claimed; the range is [lastSeq - count + 1, lastSeq]. */
  lastSeq: number;
  /** Every seq claimed, in ascending order (the range materialized). */
  seqs: number[];
  /** True when a pending registry entry was recorded and `confirmSyncSeqs` must clear it. */
  registered: boolean;
}

/**
 * C1: atomically claim `count` sequence numbers for a stream AND register them on
 * the in-flight registry so the stable frontier can exclude them until committed.
 *
 * Two modes:
 * - **No caller session (the hot path):** one `findOneAndUpdate` does `$inc: {seq}`
 *   plus `$push` of a `pending` entry per claimed seq. The write commits separately,
 *   so `confirmSyncSeqs` must `$pull` the entries once it lands. Until then the
 *   frontier holds below the lowest pending seq.
 * - **Caller session present:** the `$inc` and the document write commit atomically
 *   in the caller's transaction, so there is no window where a claimed seq is
 *   uncommitted — the pending registry is skipped (`registered: false`, nothing to
 *   confirm). Frontier logic treats a session-backed claim as already committed.
 *
 * Retries once on the upsert race (two concurrent first claims for a new stream).
 */
export const claimSyncSeqs = async ({
  stream,
  count = 1,
  session,
}: {
  stream: string;
  count?: number;
  session?: ClientSession | null;
}): Promise<SyncSeqClaim> => {
  const materialize = (lastSeq: number): number[] => {
    const seqs: number[] = [];
    for (let s = lastSeq - count + 1; s <= lastSeq; s++) {
      seqs.push(s);
    }
    return seqs;
  };

  // Session-backed fast path: the write and the $inc are already atomic, so we skip
  // the pending registry — there is never an uncommitted-but-claimed window to fence.
  if (session) {
    const doc = await SyncCounter.findOneAndUpdate(
      {stream},
      {$inc: {seq: count}},
      {new: true, session, upsert: true}
    );
    return {lastSeq: doc.seq, registered: false, seqs: materialize(doc.seq)};
  }

  const claim = async (): Promise<SyncSeqClaim> => {
    const now = new Date();
    // Claim (`$inc`) AND register the pending entries in ONE atomic aggregation-pipeline
    // update, so there is never a window where the incremented head is visible without
    // its pending claims (which would let `computeStableFrontier` transiently report a
    // frontier above an about-to-be-pending seq). `$range(oldSeq+1, newSeq+1)` materializes
    // the claimed range from the just-incremented value; `$map` turns it into pending docs.
    const doc = await SyncCounter.findOneAndUpdate(
      {stream},
      [
        {$set: {_syncOldSeq: {$ifNull: ["$seq", 0]}}},
        {$set: {seq: {$add: ["$_syncOldSeq", count]}}},
        {
          $set: {
            pending: {
              $concatArrays: [
                {$ifNull: ["$pending", []]},
                {
                  $map: {
                    as: "s",
                    in: {claimedAt: now, seq: "$$s"},
                    input: {$range: [{$add: ["$_syncOldSeq", 1]}, {$add: ["$seq", 1]}]},
                  },
                },
              ],
            },
          },
        },
        {$unset: "_syncOldSeq"},
      ],
      {new: true, upsert: true}
    );
    return {lastSeq: doc.seq, registered: true, seqs: materialize(doc.seq)};
  };
  try {
    return await claim();
  } catch (error: unknown) {
    // E11000: two concurrent upserts raced to create the counter; the loser retries
    // against the now-existing document.
    if ((error as {code?: number}).code === 11000) {
      return claim();
    }
    throw error;
  }
};

/**
 * C1: confirm that the writes owning `seqs` on `stream` have committed, clearing
 * their pending registry entries so the stable frontier can advance past them.
 * A no-op when `seqs` is empty (a session-backed claim registered nothing). Runs
 * after the document write commits (`post("save")` / query-write post hook); a
 * `$pull` failure is logged by the caller and left to age out via the lease.
 */
export const confirmSyncSeqs = async ({
  stream,
  seqs,
  session,
}: {
  stream: string;
  seqs: number[];
  session?: ClientSession | null;
}): Promise<void> => {
  if (seqs.length === 0) {
    return;
  }
  await SyncCounter.updateOne(
    {stream},
    {$pull: {pending: {seq: {$in: seqs}}}},
    session ? {session} : {}
  );
};

/**
 * C1: the stable frontier for a stream — the highest seq below which no claim is
 * uncommitted. A cursor (snapshot or delta) may advance to seq N only when N is at
 * or below this value, so no committed document is ever permanently skipped.
 *
 * frontier = `min(live pending.seq) - 1`, or the head `seq` when no live pending
 * entries remain. A pending entry older than {@link PENDING_CLAIM_LEASE_MS} is
 * considered abandoned (crashed writer): it is excluded from the min AND `$pull`ed
 * opportunistically so a crash cannot freeze the frontier forever.
 */
export const computeStableFrontier = async ({stream}: {stream: string}): Promise<number> => {
  const counter = await SyncCounter.findOne({stream});
  if (!counter) {
    return 0;
  }
  const pending = counter.pending ?? [];
  if (pending.length === 0) {
    return counter.seq;
  }
  const cutoff = Date.now() - PENDING_CLAIM_LEASE_MS;
  const staleSeqs: number[] = [];
  let minLiveSeq = Number.POSITIVE_INFINITY;
  for (const claim of pending) {
    const claimedAtMs = new Date(claim.claimedAt).getTime();
    if (claimedAtMs < cutoff) {
      staleSeqs.push(claim.seq);
      continue;
    }
    if (claim.seq < minLiveSeq) {
      minLiveSeq = claim.seq;
    }
  }
  if (staleSeqs.length > 0) {
    // Opportunistic cleanup: a crashed writer's claim must not freeze the frontier.
    await SyncCounter.updateOne({stream}, {$pull: {pending: {seq: {$in: staleSeqs}}}}).catch(
      () => {}
    );
  }
  // All pending entries were stale → frontier is the head; otherwise one below the
  // lowest live (uncommitted) claim.
  return minLiveSeq === Number.POSITIVE_INFINITY ? counter.seq : minLiveSeq - 1;
};

export interface SyncScopeMoveDocument {
  _id: mongoose.Types.ObjectId;
  collectionTag: string;
  entityId: string;
  fromStream: string;
  toStream: string;
  seq: number;
  created: Date;
}

/** C4: scope-move markers share the tombstone retention window (default 90 days). */
const SYNC_SCOPE_MOVE_TTL_SECONDS = 90 * 24 * 60 * 60;

const syncScopeMoveSchema = new Schema<SyncScopeMoveDocument>(
  {
    collectionTag: {
      description: "The collection tag of the moved document",
      required: true,
      type: String,
    },
    created: {
      default: () => new Date(),
      description: "When the move was recorded; TTL-indexed to the tombstone retention window",
      type: Date,
    },
    entityId: {
      description: "The _id of the document that moved between streams",
      required: true,
      type: String,
    },
    fromStream: {
      description: "The stream the document left (the one to tombstone)",
      required: true,
      type: String,
    },
    seq: {
      description: "Seq claimed from the OLD stream's counter; orders the tombstone in that stream",
      required: true,
      type: Number,
    },
    toStream: {
      description: "The stream the document moved into",
      required: true,
      type: String,
    },
  },
  // Consumer apps run checkModelsStrict() at startup; framework models must comply.
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);
// Old-stream snapshot catch-up pages markers by {fromStream, seq}.
syncScopeMoveSchema.index({fromStream: 1, seq: 1});
syncScopeMoveSchema.index({collectionTag: 1, entityId: 1});
syncScopeMoveSchema.index({created: 1}, {expireAfterSeconds: SYNC_SCOPE_MOVE_TTL_SECONDS});

/**
 * C4: durable marker written in the same op-scope as a scope move, replacing the
 * racy `_syncPrevStream` post-image read. The old stream tombstones the document
 * from this marker (change-stream fan-out + snapshot catch-up), so a racing second
 * write that overwrites `_syncPrevStream` can no longer erase the tombstone.
 */
export const SyncScopeMove: Model<SyncScopeMoveDocument> =
  (mongoose.models.SyncScopeMove as Model<SyncScopeMoveDocument>) ??
  mongoose.model<SyncScopeMoveDocument>("SyncScopeMove", syncScopeMoveSchema);

/** Lifecycle status of a sync mutation ledger row. */
export type SyncMutationStatus = "pending" | "applied" | "conflicted" | "failed";

export interface SyncMutationDocument {
  _id: mongoose.Types.ObjectId;
  mutationId: string;
  userId: string;
  status: SyncMutationStatus;
  nackCode?: string;
  resultId?: string;
  resultSeq?: number;
  serverDoc?: unknown;
  error?: string;
  created: Date;
  claimedAt: Date;
}

/** Ledger rows are only needed while a client could still replay a mutation. */
const SYNC_MUTATION_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * C5 (FIX 6): a `pending` row older than this may be taken over by a fresh
 * delivery — the original claimant is assumed to have crashed between the
 * claim and finalizing the ledger row.
 */
export const SYNC_MUTATION_LEASE_MS = 60 * 1_000;

const syncMutationSchema = new Schema<SyncMutationDocument>(
  {
    claimedAt: {
      default: () => new Date(),
      description:
        "When this delivery claimed the mutation (lease); a pending row older than " +
        "SYNC_MUTATION_LEASE_MS may be taken over by a fresh delivery via findOneAndUpdate",
      type: Date,
    },
    created: {
      default: () => new Date(),
      description: "When the mutation was first claimed; TTL-indexed so rows expire after 30 days",
      type: Date,
    },
    error: {
      description: "Error message recorded for rejected mutations",
      type: String,
    },
    mutationId: {
      description:
        "Client-generated idempotency key; unique so concurrent deliveries claim exactly once",
      required: true,
      type: String,
      unique: true,
    },
    nackCode: {
      description:
        "Nack code recorded for rejected mutations (conflict/unauthorized/validation/error)",
      type: String,
    },
    resultId: {
      description: "The affected document id, recorded when the mutation is applied",
      type: String,
    },
    resultSeq: {
      description: "The document's _syncSeq after apply (applied) or at conflict time (conflicted)",
      type: Number,
    },
    serverDoc: {
      description: "Canonical serialized server document, recorded for conflict nacks",
      type: Schema.Types.Mixed,
    },
    status: {
      description: "Lifecycle status: pending while applying, then applied, conflicted, or failed",
      enum: ["pending", "applied", "conflicted", "failed"],
      required: true,
      type: String,
    },
    userId: {
      description: "The user who submitted the mutation; replays from other users are rejected",
      required: true,
      type: String,
    },
  },
  // Consumer apps run checkModelsStrict() at startup; framework models must comply.
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);
syncMutationSchema.index({created: 1}, {expireAfterSeconds: SYNC_MUTATION_TTL_SECONDS});

/**
 * Idempotency ledger for the sync mutation channel. A row is inserted with status
 * `pending` before a mutation is applied (the atomic claim on the unique mutationId);
 * the outcome is recorded on the same row so duplicate deliveries — socket retries or
 * the HTTP fallback racing a socket send — read back the recorded outcome instead of
 * re-applying.
 */
export const SyncMutation: Model<SyncMutationDocument> =
  (mongoose.models.SyncMutation as Model<SyncMutationDocument>) ??
  mongoose.model<SyncMutationDocument>("SyncMutation", syncMutationSchema);

export interface SyncKeyDocument {
  _id: mongoose.Types.ObjectId;
  userId: string;
  keyMaterial: string;
  created: Date;
}

const syncKeySchema = new Schema<SyncKeyDocument>(
  {
    created: {
      default: () => new Date(),
      description: "When this key material was generated",
      type: Date,
    },
    keyMaterial: {
      description: "Server-generated random key material (32 bytes, base64) for HKDF derivation",
      required: true,
      type: String,
    },
    userId: {
      description: "The user this key material belongs to",
      required: true,
      type: String,
      unique: true,
    },
  },
  // Consumer apps run checkModelsStrict() at startup; framework models must comply.
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

export const SyncKey: Model<SyncKeyDocument> =
  (mongoose.models.SyncKey as Model<SyncKeyDocument>) ??
  mongoose.model<SyncKeyDocument>("SyncKey", syncKeySchema);

/**
 * Return the user's key material, generating it on first call. Race-safe: concurrent
 * first calls converge on the single persisted value via `$setOnInsert` upsert — a
 * caller must never receive bytes that were not persisted, or its encrypted store
 * would be undecryptable by any other session.
 */
export const getOrCreateSyncKeyMaterial = async ({userId}: {userId: string}): Promise<string> => {
  const candidate = crypto.randomBytes(32).toString("base64");
  const doc = await SyncKey.findOneAndUpdate(
    {userId},
    {$setOnInsert: {created: new Date(), keyMaterial: candidate, userId}},
    {new: true, upsert: true}
  );
  return doc.keyMaterial;
};
