import crypto from "node:crypto";
import mongoose, {type ClientSession, type Model, Schema} from "mongoose";

/**
 * Mongoose models backing the SyncDB protocol: the per-stream monotonic counter
 * and the per-user encryption key material.
 */

export interface SyncCounterDocument {
  _id: mongoose.Types.ObjectId;
  stream: string;
  seq: number;
}

const syncCounterSchema = new Schema<SyncCounterDocument>({
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
});

export const SyncCounter: Model<SyncCounterDocument> =
  (mongoose.models.SyncCounter as Model<SyncCounterDocument>) ??
  mongoose.model<SyncCounterDocument>("SyncCounter", syncCounterSchema);

/**
 * Atomically claim `count` sequence numbers for a stream. Returns the last seq
 * claimed; a batch of N owns the range [result - N + 1, result]. Retries once on
 * the upsert race (two concurrent first claims for a new stream).
 */
export const claimSyncSeqs = async ({
  stream,
  count = 1,
  session,
}: {
  stream: string;
  count?: number;
  session?: ClientSession | null;
}): Promise<number> => {
  const claim = async (): Promise<number> => {
    const doc = await SyncCounter.findOneAndUpdate(
      {stream},
      {$inc: {seq: count}},
      {new: true, session: session ?? undefined, upsert: true}
    );
    return doc.seq;
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
}

/** Ledger rows are only needed while a client could still replay a mutation. */
const SYNC_MUTATION_TTL_SECONDS = 30 * 24 * 60 * 60;

const syncMutationSchema = new Schema<SyncMutationDocument>({
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
});
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

const syncKeySchema = new Schema<SyncKeyDocument>({
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
});

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
