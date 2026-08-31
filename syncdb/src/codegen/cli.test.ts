import {describe, expect, it} from "bun:test";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

const cliPath = join(import.meta.dir, "cli.ts");
const fixturePath = join(import.meta.dir, "fixtures", "openapi.example.json");

describe("terreno-syncdb-codegen CLI", () => {
  it("prints usage and exits 1 without required args", async () => {
    const proc = Bun.spawn(["bun", cliPath], {stderr: "pipe", stdout: "pipe"});
    const code = await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    expect(code).toBe(1);
    expect(stderr).toContain("Usage: terreno-syncdb-codegen");
  });

  it("writes the SDK for the fixture spec", async () => {
    const dir = await mkdtemp(join(tmpdir(), "syncdb-cli-"));
    const out = join(dir, "out.ts");
    try {
      const proc = Bun.spawn(
        ["bun", cliPath, "--schema", fixturePath, "--out", out, "--no-format"],
        {stderr: "pipe", stdout: "pipe"}
      );
      const code = await proc.exited;
      expect(code).toBe(0);
      const source = await readFile(out, "utf8");
      expect(source).toContain("useTodos");
    } finally {
      await rm(dir, {force: true, recursive: true});
    }
  });

  it("honors --config retries override", async () => {
    const dir = await mkdtemp(join(tmpdir(), "syncdb-cli-"));
    const out = join(dir, "out.ts");
    const configPath = join(dir, "config.json");
    try {
      await writeFile(configPath, JSON.stringify({overrides: {todos: {retries: false}}}));
      const proc = Bun.spawn(
        [
          "bun",
          cliPath,
          "--schema",
          fixturePath,
          "--out",
          out,
          "--config",
          configPath,
          "--no-format",
        ],
        {stderr: "pipe", stdout: "pipe"}
      );
      expect(await proc.exited).toBe(0);
      expect(await readFile(out, "utf8")).toContain("retries: false");
    } finally {
      await rm(dir, {force: true, recursive: true});
    }
  });
});
