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
