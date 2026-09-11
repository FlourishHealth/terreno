import type mongoose from "mongoose";

/** Mongo collection that stores applied migration rows and the lock document. */
export const MIGRATIONS_COLLECTION = "terreno_migrations";

/** Reserved `_id` for the migrate lock row (Task 1.2). */
export const MIGRATION_LOCK_ID = "_lock";

/** Native collection documents in `terreno_migrations` (string `_id`, not ObjectId). */
export interface MigrationStoreDoc {
  _id: string;
  id?: string;
  checksum?: string;
  appliedAt?: Date;
  holder?: string;
  heartbeatAt?: Date;
  expiresAt?: Date;
}

export interface MigrationLogger {
  debug: (message: string, ...meta: unknown[]) => void;
  info: (message: string, ...meta: unknown[]) => void;
  warn: (message: string, ...meta: unknown[]) => void;
  error: (message: string, ...meta: unknown[]) => void;
}

export interface MigrationContext {
  dryRun: boolean;
  mongoose: typeof mongoose;
  logger: MigrationLogger;
  addLog?: (level: "info" | "warn" | "error", message: string) => Promise<void>;
  checkCancellation?: () => Promise<void>;
}

export interface MigrationModule {
  id: string;
  up: (ctx: MigrationContext) => Promise<void>;
  down?: (ctx: MigrationContext) => Promise<void>;
  schemaAfter?: unknown;
}

export interface LoadedMigration extends MigrationModule {
  checksum: string;
}

export interface AppliedMigrationRecord {
  id: string;
  checksum: string;
  appliedAt: Date;
}

export interface RunMigrationsOptions {
  migrations: LoadedMigration[];
  dryRun: boolean;
  connection: mongoose.Connection;
  mongoose: typeof mongoose;
  logger?: MigrationLogger;
  lockTtlMs?: number;
  lockPollMs?: number;
  checkCancellation?: () => Promise<void>;
  addLog?: MigrationContext["addLog"];
}

export interface RunMigrationsResult {
  applied: string[];
  skipped: string[];
  dryRun: boolean;
}

export interface RunDownMigrationsOptions {
  migrations: LoadedMigration[];
  dryRun: boolean;
  connection: mongoose.Connection;
  mongoose: typeof mongoose;
  logger?: MigrationLogger;
  lockTtlMs?: number;
  lockPollMs?: number;
  steps: number;
}

export interface RunDownMigrationsResult {
  reversed: string[];
  dryRun: boolean;
}

export interface MigrationStatus {
  applied: AppliedMigrationRecord[];
  pending: Array<{id: string; checksum: string}>;
  lock: {holder: string; expiresAt: Date} | null;
}
