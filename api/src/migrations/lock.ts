import {randomUUID} from "node:crypto";

import {DateTime} from "luxon";
import type mongoose from "mongoose";

import {MIGRATION_LOCK_ID, MIGRATIONS_COLLECTION, type MigrationStoreDoc} from "./types";

/** Default lock lifetime before another runner may steal it. */
export const MIGRATION_LOCK_TTL_MS = 10 * 60 * 1000;

export interface WithMigrationLockOptions<T> {
  connection: mongoose.Connection;
  fn: () => Promise<T>;
  ttlMs?: number;
  pollMs?: number;
  holder?: string;
  now?: () => DateTime;
}

const lockCollection = (
  connection: mongoose.Connection
): mongoose.Collection<MigrationStoreDoc> => {
  return connection.collection<MigrationStoreDoc>(MIGRATIONS_COLLECTION);
};

const isDuplicateKey = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = "code" in error ? error.code : undefined;
  return code === 11000;
};

const tryAcquire = async ({
  col,
  expiresAt,
  holder,
  nowJs,
}: {
  col: mongoose.Collection<MigrationStoreDoc>;
  expiresAt: Date;
  holder: string;
  nowJs: Date;
}): Promise<boolean> => {
  try {
    await col.insertOne({
      _id: MIGRATION_LOCK_ID,
      expiresAt,
      heartbeatAt: nowJs,
      holder,
    });
    return true;
  } catch (error) {
    if (!isDuplicateKey(error)) {
      throw error;
    }
  }

  const stolen = await col.findOneAndUpdate(
    {_id: MIGRATION_LOCK_ID, expiresAt: {$lte: nowJs}},
    {$set: {expiresAt, heartbeatAt: nowJs, holder}},
    {returnDocument: "after"}
  );
  return stolen !== null && stolen.holder === holder;
};

export const withMigrationLock = async <T>({
  connection,
  fn,
  holder = randomUUID(),
  now = () => DateTime.now(),
  pollMs = 1000,
  ttlMs = MIGRATION_LOCK_TTL_MS,
}: WithMigrationLockOptions<T>): Promise<T> => {
  const col = lockCollection(connection);

  const acquire = async (): Promise<void> => {
    while (true) {
      const nowDt = now();
      const nowJs = nowDt.toJSDate();
      const expiresAt = nowDt.plus({milliseconds: ttlMs}).toJSDate();
      const acquired = await tryAcquire({col, expiresAt, holder, nowJs});
      if (acquired) {
        return;
      }
      await Bun.sleep(pollMs);
    }
  };

  await acquire();

  const heartbeat = setInterval(
    () => {
      const nowDt = now();
      void col.updateOne(
        {_id: MIGRATION_LOCK_ID, holder},
        {
          $set: {
            expiresAt: nowDt.plus({milliseconds: ttlMs}).toJSDate(),
            heartbeatAt: nowDt.toJSDate(),
          },
        }
      );
    },
    Math.max(50, Math.floor(ttlMs / 3))
  );

  try {
    return await fn();
  } finally {
    clearInterval(heartbeat);
    await col.deleteOne({_id: MIGRATION_LOCK_ID, holder});
  }
};
