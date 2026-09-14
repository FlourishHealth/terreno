/**
 * Load and validate timestamped `migrations/<YYYYMMDDHHmmss>-<slug>.ts` files
 * without connecting to Mongo. Used by `terreno-migrate check` and as input to the runner.
 */
import {createHash} from "node:crypto";
import {readdir, readFile} from "node:fs/promises";
import {join} from "node:path";
import {pathToFileURL} from "node:url";

import {APIError} from "../errors";
import type {LoadedMigration, MigrationModule} from "./types";

export const MIGRATION_FILENAME = /^(\d{14})-[a-z0-9-]+\.ts$/;

/** Bun compile (`bun build --compile`) puts modules on a virtual FS. */
const isBunVirtualFsPath = (value: string): boolean => {
  return value.includes("$bunfs");
};

/**
 * Pick a real on-disk migrations directory.
 * `bun build --compile` rewrites `import.meta.url` to `$bunfs`, which is not
 * scandir-able. Prefer an explicit real `dir`, then `MIGRATIONS_DIR`, then
 * `<cwd>/migrations`.
 */
export const resolveMigrationDir = ({
  cwd = process.cwd(),
  dir,
  envDir = process.env.MIGRATIONS_DIR,
}: {
  cwd?: string;
  dir?: string;
  envDir?: string;
}): string => {
  if (dir && !isBunVirtualFsPath(dir)) {
    return dir;
  }
  if (envDir) {
    return envDir;
  }
  return join(cwd, "migrations");
};

const readMigrationFilenames = async (dir: string): Promise<string[]> => {
  try {
    return await readdir(dir);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new APIError({
        detail: `No directory at ${dir}`,
        status: 404,
        title: "Migration directory not found",
      });
    }
    throw error;
  }
};

const checksumOf = (source: string): string => {
  return createHash("sha256").update(source).digest("hex");
};

const expectedIdFromFilename = (filename: string): string => {
  return filename.replace(/\.ts$/, "");
};

export const checkMigrationFiles = async ({dir}: {dir: string}): Promise<LoadedMigration[]> => {
  const resolvedDir = resolveMigrationDir({dir});
  const entries = await readMigrationFilenames(resolvedDir);
  const files = entries.filter((name) => name.endsWith(".ts")).sort();
  const loaded: LoadedMigration[] = [];
  const seenIds = new Set<string>();

  for (const filename of files) {
    if (!MIGRATION_FILENAME.test(filename)) {
      throw new APIError({
        detail: `Expected YYYYMMDDHHmmss-slug.ts, received ${filename}`,
        status: 400,
        title: "Invalid migration filename",
      });
    }

    const source = await readFile(join(resolvedDir, filename), "utf8");
    const mod = (await import(pathToFileURL(join(resolvedDir, filename)).href)) as MigrationModule;
    const expectedId = expectedIdFromFilename(filename);
    if (mod.id !== expectedId) {
      throw new APIError({
        detail: `File ${filename} exported id ${String(mod.id)}`,
        status: 400,
        title: "Migration id does not match filename",
      });
    }
    if (typeof mod.up !== "function") {
      throw new APIError({
        detail: `${filename} must export an up function`,
        status: 400,
        title: "Migration missing up",
      });
    }
    if (seenIds.has(mod.id)) {
      throw new APIError({
        detail: `Duplicate migration id ${mod.id}`,
        status: 400,
        title: "Duplicate migration id",
      });
    }
    seenIds.add(mod.id);
    loaded.push({
      checksum: checksumOf(source),
      down: mod.down,
      id: mod.id,
      schemaAfter: mod.schemaAfter,
      up: mod.up,
    });
  }

  return loaded;
};

/** Public alias for `checkMigrationFiles`; kept as a wrapper so Knip does not treat it as a duplicate export. */
export const loadMigrations = async ({dir}: {dir: string}): Promise<LoadedMigration[]> => {
  return checkMigrationFiles({dir});
};
