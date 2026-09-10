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
  type MigrationStatus,
  type MigrationStoreDoc,
  type RunDownMigrationsOptions,
  type RunDownMigrationsResult,
  type RunMigrationsOptions,
  type RunMigrationsResult,
} from "./types";

const historyCollection = (
  connection: mongoose.Connection
): mongoose.Collection<MigrationStoreDoc> => {
  return connection.collection<MigrationStoreDoc>(MIGRATIONS_COLLECTION);
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

const removeApplied = async ({
  connection,
  id,
}: {
  connection: mongoose.Connection;
  id: string;
}): Promise<void> => {
  await historyCollection(connection).deleteOne({_id: id});
};

export const getMigrationStatus = async ({
  connection,
  migrations,
}: {
  connection: mongoose.Connection;
  migrations: LoadedMigration[];
}): Promise<MigrationStatus> => {
  const appliedRecords = await loadApplied(connection);
  const applied: AppliedMigrationRecord[] = [];
  const pending: Array<{checksum: string; id: string}> = [];
  for (const migration of migrations) {
    const existing = appliedRecords.get(migration.id);
    if (existing) {
      applied.push(existing);
      continue;
    }
    pending.push({checksum: migration.checksum, id: migration.id});
  }

  const lockDoc = await historyCollection(connection).findOne({_id: MIGRATION_LOCK_ID});
  const lock =
    lockDoc == null
      ? null
      : {
          expiresAt:
            lockDoc.expiresAt instanceof Date
              ? lockDoc.expiresAt
              : new Date(String(lockDoc.expiresAt)),
          holder: String(lockDoc.holder ?? ""),
        };

  return {applied, lock, pending};
};

export const runDownMigrations = async ({
  connection,
  dryRun,
  lockPollMs,
  lockTtlMs,
  logger = defaultLogger,
  migrations,
  mongoose: mongooseNs,
  steps,
}: RunDownMigrationsOptions): Promise<RunDownMigrationsResult> => {
  if (!Number.isInteger(steps) || steps < 1) {
    throw new APIError({
      detail: "down --steps must be a positive integer",
      status: 400,
      title: "Invalid down steps",
    });
  }

  const execute = async (): Promise<RunDownMigrationsResult> => {
    const appliedRecords = await loadApplied(connection);
    const appliedInOrder = migrations.filter((migration) => appliedRecords.has(migration.id));
    const targets = appliedInOrder.slice(-steps).reverse();
    const reversed: string[] = [];

    const reversible = targets.map((migration) => {
      if (typeof migration.down !== "function") {
        throw new APIError({
          detail: `Migration ${migration.id} has no down. Rollback stopped.`,
          status: 400,
          title: "Migration has no down",
        });
      }
      return {down: migration.down, id: migration.id};
    });

    for (const migration of reversible) {
      const ctx: MigrationContext = {
        dryRun,
        logger,
        mongoose: mongooseNs,
      };
      await migration.down(ctx);
      reversed.push(migration.id);
      if (!dryRun) {
        await removeApplied({connection, id: migration.id});
      }
    }

    return {dryRun, reversed};
  };

  return withMigrationLock({
    connection,
    fn: execute,
    pollMs: lockPollMs,
    ttlMs: lockTtlMs,
  });
};
