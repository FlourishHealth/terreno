import {beforeEach, describe, expect, it} from "bun:test";
import {join} from "node:path";
import mongoose from "mongoose";

import {setupDb} from "../tests";
import {runMigrateCli} from "./cli";
import {MIGRATION_LOCK_ID, MIGRATIONS_COLLECTION} from "./types";

const fixtures = (...parts: string[]): string => {
  return join(import.meta.dir, "fixtures", ...parts);
};

const capture = (): {
  stderr: string;
  stdout: string;
  writeErr: (chunk: string) => void;
  writeOut: (chunk: string) => void;
} => {
  const out: string[] = [];
  const err: string[] = [];
  return {
    get stderr(): string {
      return err.join("");
    },
    get stdout(): string {
      return out.join("");
    },
    writeErr: (chunk: string): void => {
      err.push(chunk);
    },
    writeOut: (chunk: string): void => {
      out.push(chunk);
    },
  };
};

const appliedIds = async (): Promise<string[]> => {
  const docs = await mongoose.connection
    .collection(MIGRATIONS_COLLECTION)
    .find({_id: {$ne: MIGRATION_LOCK_ID}})
    .project({id: 1})
    .toArray();
  return docs.map((doc) => String(doc.id)).sort();
};

describe("runMigrateCli", () => {
  beforeEach(async () => {
    await setupDb();
    await mongoose.connection.collection(MIGRATIONS_COLLECTION).deleteMany({});
  });

  it("prints usage on --help and exits 0", async () => {
    const io = capture();
    const code = await runMigrateCli({
      argv: ["--help"],
      stderr: {write: io.writeErr},
      stdout: {write: io.writeOut},
    });
    expect(code).toBe(0);
    expect(`${io.stdout}${io.stderr}`).toContain("terreno-migrate");
    expect(`${io.stdout}${io.stderr}`).toContain("check");
  });

  it("generate without --models exits 1", async () => {
    const io = capture();
    const code = await runMigrateCli({
      argv: ["generate", "--dir", fixtures("valid")],
      stderr: {write: io.writeErr},
      stdout: {write: io.writeOut},
    });
    expect(code).toBe(1);
    expect(io.stderr).toContain("Missing --models");
  });

  it("check validates files without Mongo", async () => {
    const io = capture();
    const code = await runMigrateCli({
      argv: ["check", "--dir", fixtures("valid")],
      stderr: {write: io.writeErr},
      stdout: {write: io.writeOut},
    });
    expect(code).toBe(0);
    expect(io.stdout).toContain("20260910120000-alpha");
  });

  it("dry up calls pending files and does not write history", async () => {
    const io = capture();
    const code = await runMigrateCli({
      argv: ["up", "--dir", fixtures("valid"), "--dry"],
      mongoose,
      stderr: {write: io.writeErr},
      stdout: {write: io.writeOut},
    });
    expect(code).toBe(0);
    expect(io.stdout).toContain("20260910120000-alpha");
    expect(await appliedIds()).toEqual([]);
  });

  it("denies production wet up without ALLOW_MIGRATIONS", async () => {
    const io = capture();
    const code = await runMigrateCli({
      argv: ["up", "--dir", fixtures("valid"), "--force"],
      env: {NODE_ENV: "production"},
      mongoose,
      stderr: {write: io.writeErr},
      stdout: {write: io.writeOut},
    });
    expect(code).toBe(1);
    expect(io.stderr).toContain("Migrations not allowed");
    expect(await appliedIds()).toEqual([]);
  });

  it("denies production wet up when ALLOW_MIGRATIONS is set without --force", async () => {
    const io = capture();
    const code = await runMigrateCli({
      argv: ["up", "--dir", fixtures("valid")],
      env: {ALLOW_MIGRATIONS: "true", NODE_ENV: "production"},
      mongoose,
      stderr: {write: io.writeErr},
      stdout: {write: io.writeOut},
    });
    expect(code).toBe(1);
    expect(io.stderr).toContain("Migrations not allowed");
  });

  it("status lists pending files before up", async () => {
    const io = capture();
    const code = await runMigrateCli({
      argv: ["status", "--dir", fixtures("valid")],
      env: {NODE_ENV: "test"},
      mongoose,
      stderr: {write: io.writeErr},
      stdout: {write: io.writeOut},
    });
    expect(code).toBe(0);
    expect(io.stdout).toContain("Pending (2)");
    expect(io.stdout).toContain("20260910120000-alpha");
  });

  it("applies then rolls back against Mongo", async () => {
    const upIo = capture();
    const upCode = await runMigrateCli({
      argv: ["up", "--dir", fixtures("valid")],
      env: {NODE_ENV: "test"},
      mongoose,
      stderr: {write: upIo.writeErr},
      stdout: {write: upIo.writeOut},
    });
    expect(upCode).toBe(0);
    expect(await appliedIds()).toEqual(["20260910120000-alpha", "20260910120001-beta"]);

    const downIo = capture();
    const downCode = await runMigrateCli({
      argv: ["down", "--dir", fixtures("valid"), "--steps", "1"],
      env: {NODE_ENV: "test"},
      mongoose,
      stderr: {write: downIo.writeErr},
      stdout: {write: downIo.writeOut},
    });
    expect(downCode).toBe(0);
    expect(await appliedIds()).toEqual(["20260910120000-alpha"]);
  });

  it("fails down when the target file has no down", async () => {
    await runMigrateCli({
      argv: ["up", "--dir", fixtures("valid")],
      env: {NODE_ENV: "test"},
      mongoose,
      stderr: {write: () => undefined},
      stdout: {write: () => undefined},
    });
    await runMigrateCli({
      argv: ["down", "--dir", fixtures("valid"), "--steps", "1"],
      env: {NODE_ENV: "test"},
      mongoose,
      stderr: {write: () => undefined},
      stdout: {write: () => undefined},
    });

    const io = capture();
    const code = await runMigrateCli({
      argv: ["down", "--dir", fixtures("valid"), "--steps", "1"],
      env: {NODE_ENV: "test"},
      mongoose,
      stderr: {write: io.writeErr},
      stdout: {write: io.writeOut},
    });
    expect(code).toBe(1);
    expect(io.stderr).toContain("has no down");
    expect(await appliedIds()).toEqual(["20260910120000-alpha"]);
  });
});
