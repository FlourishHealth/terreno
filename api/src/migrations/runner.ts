/**
 * Apply, roll back, and inspect MongoDB migration history. This module also
 * owns the production wet-apply gate, the TerrenoApp `runOnStart` hook, and the
 * CI helper that applies then reverses reversible files.
 */
import {DateTime} from "luxon";
import mongoose from "mongoose";

import {APIError} from "../errors";
import {logger as defaultLogger} from "../logger";
import {checkMigrationFiles} from "./load";
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

const toJsDate = (value: Date | string | undefined): Date => {
  if (value instanceof Date) {
    const parsed = DateTime.fromJSDate(value, {zone: "utc"});
    if (!parsed.isValid) {
      throw new APIError({status: 500, title: "Invalid migration timestamp"});
    }
    return parsed.toJSDate();
  }
  const parsed = DateTime.fromISO(String(value ?? ""), {zone: "utc"});
  if (!parsed.isValid) {
    throw new APIError({status: 500, title: "Invalid migration timestamp"});
  }
  return parsed.toJSDate();
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
      appliedAt: toJsDate(doc.appliedAt),
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
    appliedAt: DateTime.utc().toJSDate(),
    checksum: migration.checksum,
    id: migration.id,
  });
};

export const runMigrations = async ({
  addLog,
  checkCancellation,
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
        addLog,
        checkCancellation,
        dryRun,
        logger,
        mongoose: mongooseNs,
      };
      await checkCancellation?.();
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

  const collection = historyCollection(connection);
  const lockDoc = await collection.findOne({_id: MIGRATION_LOCK_ID});
  const lock =
    lockDoc == null
      ? null
      : {
          expiresAt: toJsDate(lockDoc.expiresAt),
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
      await ctx.checkCancellation?.();
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

export interface AssertMigrationsAllowedOptions {
  allowEnv: boolean;
  dryRun: boolean;
  force: boolean;
  isProduction: boolean;
}

/** Fail closed for production wet apply unless ALLOW_MIGRATIONS and force (CLI `--force` or boot/admin Apply). */
export const assertMigrationsAllowed = ({
  allowEnv,
  dryRun,
  force,
  isProduction,
}: AssertMigrationsAllowedOptions): void => {
  if (dryRun) {
    return;
  }
  if (!isProduction) {
    return;
  }
  if (allowEnv && force) {
    return;
  }

  const detail = allowEnv
    ? "Production wet migrations also require --force (or an equivalent boot/admin Apply)."
    : "Set ALLOW_MIGRATIONS=true for production wet migrations.";
  throw new APIError({
    detail,
    status: 403,
    title: "Migrations not allowed",
  });
};

export interface StartupMigrationsOption {
  dir: string;
  runOnStart?: boolean;
}

export const runStartupMigrations = async ({
  env = process.env,
  migrations,
  mongoose: mongooseNs,
}: {
  env?: NodeJS.ProcessEnv;
  migrations?: StartupMigrationsOption;
  mongoose: typeof mongoose;
}): Promise<{applied: string[]; ran: boolean}> => {
  if (!migrations?.runOnStart) {
    return {applied: [], ran: false};
  }

  assertMigrationsAllowed({
    allowEnv: env.ALLOW_MIGRATIONS === "true",
    dryRun: false,
    force: true,
    isProduction: env.NODE_ENV === "production",
  });

  const loaded = await checkMigrationFiles({dir: migrations.dir});
  const result = await runMigrations({
    connection: mongooseNs.connection,
    dryRun: false,
    migrations: loaded,
    mongoose: mongooseNs,
  });
  return {applied: result.applied, ran: true};
};

export interface ExerciseReversibleMigrationsOptions {
  dir: string;
  connect: () => Promise<mongoose.Connection>;
}

export interface ExerciseReversibleMigrationsResult {
  applied: string[];
  reversed: string[];
  skippedIrreversible: string | null;
}

/**
 * CI helper: apply every file, then roll back in reverse until a file without
 * `down` stops the chain. The irreversible id is recorded; earlier files stay applied.
 */
export const exerciseReversibleMigrations = async ({
  connect,
  dir,
}: ExerciseReversibleMigrationsOptions): Promise<ExerciseReversibleMigrationsResult> => {
  const connection = await connect();
  const migrations = await checkMigrationFiles({dir});
  const upResult = await runMigrations({
    connection,
    dryRun: false,
    migrations,
    mongoose,
  });

  const reversed: string[] = [];
  let skippedIrreversible: string | null = null;
  for (const migration of [...migrations].reverse()) {
    if (typeof migration.down !== "function") {
      skippedIrreversible = migration.id;
      break;
    }
    const downResult = await runDownMigrations({
      connection,
      dryRun: false,
      migrations,
      mongoose,
      steps: 1,
    });
    reversed.push(...downResult.reversed);
  }

  return {
    applied: [...upResult.applied, ...upResult.skipped],
    reversed,
    skippedIrreversible,
  };
};
