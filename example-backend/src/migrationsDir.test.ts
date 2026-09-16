import {describe, it} from "bun:test";
import {readdirSync} from "node:fs";
import {assert} from "chai";
import {resolveExampleMigrationsDir} from "./migrationsDir";

describe("resolveExampleMigrationsDir", () => {
  it("resolves the package migrations/ directory from source", () => {
    const dir = resolveExampleMigrationsDir();
    assert.include(readdirSync(dir), "20260910120000-todos-title-owner-index.ts");
  });

  it("does not let MIGRATIONS_DIR override a real on-disk import.meta path", () => {
    process.env.MIGRATIONS_DIR = "/tmp/explicit-migrations";
    try {
      const resolved = resolveExampleMigrationsDir();
      assert.notEqual(resolved, "/tmp/explicit-migrations");
      assert.include(readdirSync(resolved), "20260910120000-todos-title-owner-index.ts");
    } finally {
      Reflect.deleteProperty(process.env, "MIGRATIONS_DIR");
    }
  });
});
