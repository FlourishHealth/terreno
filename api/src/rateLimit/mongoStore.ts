import mongoose from "mongoose";

import {APIError} from "../errors";
import type {RateLimitConsumeArgs, RateLimitConsumeResult, RateLimitStore} from "./types";

export const RATE_LIMIT_HITS_COLLECTION = "rateLimitHits";

const ensureIndexes = async (collection: mongoose.mongo.Collection): Promise<void> => {
  await collection.createIndex({key: 1}, {unique: true});
  await collection.createIndex({expiresAt: 1}, {expireAfterSeconds: 0});
};

export const createMongoRateLimitStore = (): RateLimitStore => {
  let indexed = false;

  const consume = async ({
    key,
    max,
    windowMs,
    now,
  }: RateLimitConsumeArgs): Promise<RateLimitConsumeResult> => {
    const db = mongoose.connection.db;
    if (!db) {
      throw new APIError({
        status: 500,
        title: "Mongo rate limit store requires an open mongoose connection",
      });
    }
    const collection = db.collection(RATE_LIMIT_HITS_COLLECTION);
    if (!indexed) {
      await ensureIndexes(collection);
      indexed = true;
    }

    const existing = await collection.findOne({key});
    const expiresAtMs =
      existing?.expiresAt instanceof Date ? existing.expiresAt.getTime() : undefined;
    if (!existing || expiresAtMs === undefined || expiresAtMs <= now) {
      const resetAt = now + windowMs;
      await collection.replaceOne(
        {key},
        {expiresAt: new Date(resetAt), hits: 1, key},
        {upsert: true}
      );
      return {allowed: true, remaining: Math.max(0, max - 1), resetAt};
    }

    const updated = await collection.findOneAndUpdate(
      {key},
      {$inc: {hits: 1}},
      {returnDocument: "after"}
    );
    const hits = Number(updated?.hits ?? 0);
    return {
      allowed: hits <= max,
      remaining: Math.max(0, max - hits),
      resetAt: expiresAtMs,
    };
  };

  return {consume};
};
