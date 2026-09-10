import type mongoose from "mongoose";

import {APIError} from "../errors";
import {logger as defaultLogger} from "../logger";
import {withMigrationLock} from "./lock";
import {
  type AppliedMigrationRecord,
  type LoadedMigration,
  MIGRATION_LOCK_ID,
  MIGRATIONS_COLLECTION,
  type MigrationContext,
  type RunMigrationsOptions,
  type RunMigrationsResult,
} from "./types";

const historyCollection = (connection: mongoose.Connection): mongoose.Collection => {
  return connection.collection(MIGRATIONS_COLLECTION);
};

const loadApplied = async (
  connection: mongoose.Connection
): Promise<Map<string, AppliedMigrationRecord>> => {
  const docs = await historyCollection(connection)
    .find({_id: {$ne: MIGRATION_LOCK_ID}})
    .toArray();
  const applied = new Map<string, AppliedMigrationRecord>();
  for (const doc of docs) {
    const id = String(doc.id ?? doc._id);
    applied.set(id, {
      appliedAt: doc.appliedAt instanceof Date ? doc.appliedAt : new Date(String(doc.appliedAt)),
      checksum: String(doc.checksum ?? ""),
      id,
    });
  }
  return applied;
};

const recordApplied = async ({
  connection,
  migration,
}: {
  connection: mongoose.Connection;
  migration: LoadedMigration;
}): Promise<void> => {
  await historyCollection(connection).insertOne({
    _id: migration.id,
    appliedAt: new Date(),
    checksum: migration.checksum,
    id: migration.id,
  });
};

export const runMigrations = async ({
  connection,
  dryRun,
  lockPollMs,
  lockTtlMs,
  logger = defaultLogger,
  migrations,
  mongoose: mongooseNs,
}: RunMigrationsOptions): Promise<RunMigrationsResult> => {
  const execute = async (): Promise<RunMigrationsResult> => {
    const appliedRecords = await loadApplied(connection);
    const applied: string[] = [];
    const skipped: string[] = [];

    for (const migration of migrations) {
      const existing = appliedRecords.get(migration.id);
      if (existing) {
        if (existing.checksum !== migration.checksum) {
          throw new APIError({
            detail: `Migration ${migration.id} was applied with checksum ${existing.checksum} but the current file is ${migration.checksum}`,
            status: 409,
            title: "Migration checksum mismatch",
          });
        }
        skipped.push(migration.id);
        continue;
      }

      const ctx: MigrationContext = {
        dryRun,
        logger,
        mongoose: mongooseNs,
      };
      await migration.up(ctx);
      applied.push(migration.id);
      if (!dryRun) {
        await recordApplied({connection, migration});
      }
    }

    return {applied, dryRun, skipped};
  };

  return withMigrationLock({
    connection,
    fn: execute,
    pollMs: lockPollMs,
    ttlMs: lockTtlMs,
  });
};
