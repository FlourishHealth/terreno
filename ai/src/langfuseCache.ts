import mongoose from "mongoose";

import type {LangfuseCachedPrompt} from "./langfuseTypes";

interface LangfuseCacheDocument extends mongoose.Document {
  key: string;
  value: LangfuseCachedPrompt;
  expiresAt: Date;
}

const langfuseCacheSchema = new mongoose.Schema<LangfuseCacheDocument>(
  {
    expiresAt: {
      description: "When this cache entry expires",
      required: true,
      type: Date,
    },
    key: {
      description: "Cache key (e.g. prompt:chat-assistant:production)",
      required: true,
      type: String,
      unique: true,
    },
    value: {
      description: "Cached Langfuse object",
      required: true,
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

langfuseCacheSchema.index({expiresAt: 1}, {expireAfterSeconds: 0});

export const LangfuseCache =
  (mongoose.models.LangfuseCache as mongoose.Model<LangfuseCacheDocument>) ||
  mongoose.model<LangfuseCacheDocument>("LangfuseCache", langfuseCacheSchema);

export const getCached = async (key: string): Promise<LangfuseCachedPrompt | null> => {
  const entry = await LangfuseCache.findOne({expiresAt: {$gt: new Date()}, key}).lean();
  if (!entry) {
    return null;
  }
  return entry.value as LangfuseCachedPrompt;
};

export const setCached = async (
  key: string,
  value: LangfuseCachedPrompt,
  ttlSeconds: number
): Promise<void> => {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await LangfuseCache.findOneAndUpdate({key}, {expiresAt, key, value}, {upsert: true});
};

export const invalidateCache = async (keyPattern: string): Promise<void> => {
  await LangfuseCache.deleteMany({key: {$regex: keyPattern}});
};
