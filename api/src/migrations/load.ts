import {createHash} from "node:crypto";
import {readdir, readFile} from "node:fs/promises";
import {join} from "node:path";
import {pathToFileURL} from "node:url";

import {APIError} from "../errors";
import type {LoadedMigration, MigrationModule} from "./types";

export const MIGRATION_FILENAME = /^(\d{14})-[a-z0-9-]+\.ts$/;

const checksumOf = (source: string): string => {
  return createHash("sha256").update(source).digest("hex");
};

const expectedIdFromFilename = (filename: string): string => {
  return filename.replace(/\.ts$/, "");
};

export const checkMigrationFiles = async ({dir}: {dir: string}): Promise<LoadedMigration[]> => {
  const entries = await readdir(dir);
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

    const source = await readFile(join(dir, filename), "utf8");
    const mod = (await import(pathToFileURL(join(dir, filename)).href)) as MigrationModule;
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

export const loadMigrations = checkMigrationFiles;
