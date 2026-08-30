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

    const nowDate = new Date(now);
    const resetAtDate = new Date(now + windowMs);
    const updated = await collection.findOneAndUpdate(
      {key},
      [
        {
          $set: {
            expiresAt: {
              $cond: [
                {$and: [{$ne: ["$expiresAt", null]}, {$gt: ["$expiresAt", nowDate]}]},
                "$expiresAt",
                resetAtDate,
              ],
            },
            hits: {
              $cond: [
                {$and: [{$ne: ["$expiresAt", null]}, {$gt: ["$expiresAt", nowDate]}]},
                {$add: [{$ifNull: ["$hits", 0]}, 1]},
                1,
              ],
            },
            key,
          },
        },
      ],
      {returnDocument: "after", upsert: true}
    );

    const hits = Number(updated?.hits ?? 1);
    const resetAt =
      updated?.expiresAt instanceof Date ? updated.expiresAt.getTime() : now + windowMs;
    return {
      allowed: hits <= max,
      remaining: Math.max(0, max - hits),
      resetAt,
    };
  };

  return {consume};
};
