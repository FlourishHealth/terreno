import {mock} from "bun:test";

mock.module("@terreno/mcp/local-tools", () => ({
  handleLocalToolCall: async (name: string, args: Record<string, unknown>) => {
    return {content: [{text: `${name}:${JSON.stringify(args)}`, type: "text"}]};
  },
}));

mock.module("@terreno/syncdb/codegen", () => ({
  generateSyncDbSdk: async () => "export const sdk = {};",
  loadConfigFile: async () => undefined,
  parseCollectionsFlag: (value?: string) => (value ? value.split(",") : undefined),
}));

import {describe, expect, it} from "bun:test";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";

import type {CliIo} from "./io";
import {runCli} from "./runCli";

const createIo = (cwd = "/tmp"): CliIo & {stderrLines: string[]; stdoutLines: string[]} => {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  return {
    cwd,
    env: {},
    fetch: (async () => new Response()) as typeof fetch,
    stderr: (line: string) => {
      stderrLines.push(line);
    },
    stderrLines,
    stdout: (line: string) => {
      stdoutLines.push(line);
    },
    stdoutLines,
  };
};

describe("mocked local tools and syncdb", () => {
  it("prints info, logs, and db output", async () => {
    const io = createIo();
    expect(await runCli(["info"], io)).toBe(0);
    expect(await runCli(["info", "--json"], io)).toBe(0);
    expect(await runCli(["logs"], io)).toBe(0);
    expect(await runCli(["logs", "last-error", "--json"], io)).toBe(0);
    expect(await runCli(["db", "schema", "--json"], io)).toBe(0);
    expect(
      await runCli(
        [
          "db",
          "query",
          "--collection",
          "todos",
          "--operation",
          "find",
          "--filter",
          "{}",
          "--pipeline",
          "[]",
          "--field",
          "title",
          "--limit",
          "3",
          "--json",
        ],
        io
      )
    ).toBe(0);
    expect(io.stdoutLines.join("\n")).toContain("database_query");
  });

  it("generates a syncdb sdk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "terreno-cli-"));
    const io = createIo(dir);
    const code = await runCli(
      [
        "generate",
        "syncdb",
        "--schema",
        join(dir, "openapi.json"),
        "--out",
        "sdk.ts",
        "--collections",
        "todos",
        "--json",
      ],
      io
    );
    expect(code).toBe(0);
    expect(io.stdoutLines.join("\n")).toContain("ok");
    await rm(dir, {force: true, recursive: true});
  });
});
