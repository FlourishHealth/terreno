import {describe, expect, it} from "bun:test";
import {mkdtemp, readFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import {main, parseCliArgs} from "./cli";

const fixturePath = join(import.meta.dir, "fixtures", "openapi.example.json");

describe("cli", () => {
  it("parseCliArgs requires schema and out", async () => {
    await expect(parseCliArgs([])).rejects.toThrow(/Missing required/);
  });

  it("generates output file from fixture", async () => {
    const dir = await mkdtemp(join(tmpdir(), "syncdb-codegen-cli-"));
    const outPath = join(dir, "syncDbSdk.ts");
    try {
      const exitCode = await main(["--schema", fixturePath, "--out", outPath, "--no-format"]);
      expect(exitCode).toBe(0);
      const content = await readFile(outPath, "utf8");
      expect(content).toContain("useTodos");
      expect(content).toContain("SYNC_COLLECTIONS");
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  });

  it("returns exit code 1 for missing args", async () => {
    const exitCode = await main([]);
    expect(exitCode).toBe(1);
  });
});
