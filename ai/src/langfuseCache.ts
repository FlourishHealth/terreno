import {createdUpdatedPlugin, findExactlyOne, findOneOrNone, isDeletedPlugin} from "@terreno/api";
import {DateTime} from "luxon";
import mongoose, {type Document} from "mongoose";

import type {LangfuseCachedPrompt} from "./langfuseTypes";

interface LangfuseCacheDocument extends mongoose.Document {
  key: string;
  value: LangfuseCachedPrompt;
  expiresAt: Date;
}

interface LangfuseCacheModel extends mongoose.Model<LangfuseCacheDocument> {
  findOneOrNone(query: Record<string, unknown>): Promise<(Document & LangfuseCacheDocument) | null>;
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

langfuseCacheSchema.plugin(createdUpdatedPlugin);
langfuseCacheSchema.plugin(isDeletedPlugin);
langfuseCacheSchema.plugin(findOneOrNone);
langfuseCacheSchema.plugin(findExactlyOne);

export const LangfuseCache =
  (mongoose.models.LangfuseCache as LangfuseCacheModel) ||
  mongoose.model<LangfuseCacheDocument, LangfuseCacheModel>("LangfuseCache", langfuseCacheSchema);

export const getCached = async (key: string): Promise<LangfuseCachedPrompt | null> => {
  const entry = await LangfuseCache.findOneOrNone({
    expiresAt: {$gt: DateTime.now().toJSDate()},
    key,
  });
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
  const expiresAt = DateTime.now().plus({seconds: ttlSeconds}).toJSDate();
  await LangfuseCache.findOneAndUpdate({key}, {expiresAt, key, value}, {upsert: true});
};

export const invalidateCache = async (keyPattern: string): Promise<void> => {
  await LangfuseCache.deleteMany({key: {$regex: keyPattern}});
};
