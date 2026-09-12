import {describe, expect, it} from "bun:test";
import {join} from "node:path";

import {checkMigrationFiles, loadMigrations} from "./load";

const fixtures = (...parts: string[]): string => {
  return join(import.meta.dir, "fixtures", ...parts);
};

describe("checkMigrationFiles", () => {
  it("loads timestamped files in filename order with optional down", async () => {
    const loaded = await checkMigrationFiles({dir: fixtures("valid")});
    expect(loaded.map((m) => m.id)).toEqual(["20260910120000-alpha", "20260910120001-beta"]);
    expect(typeof loaded[0].up).toBe("function");
    expect(loaded[0].down).toBeUndefined();
    expect(typeof loaded[1].down).toBe("function");
    expect(loaded[0].checksum).toHaveLength(64);
  });

  it("rejects an id that does not match the filename", async () => {
    await expect(checkMigrationFiles({dir: fixtures("bad-id")})).rejects.toThrow(
      "Migration id does not match filename"
    );
  });

  it("rejects a filename that is not YYYYMMDDHHmmss-slug.ts", async () => {
    await expect(checkMigrationFiles({dir: fixtures("bad-name")})).rejects.toThrow(
      "Invalid migration filename"
    );
  });

  it("rejects a module without up", async () => {
    await expect(checkMigrationFiles({dir: fixtures("missing-up")})).rejects.toThrow(
      "Migration missing up"
    );
  });
});

describe("loadMigrations", () => {
  it("aliases checkMigrationFiles", async () => {
    const loaded = await loadMigrations({dir: fixtures("valid")});
    expect(loaded.map((migration) => migration.id)).toEqual([
      "20260910120000-alpha",
      "20260910120001-beta",
    ]);
  });
});
