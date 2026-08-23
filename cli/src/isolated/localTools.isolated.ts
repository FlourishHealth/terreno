import {mock} from "bun:test";

mock.module("@terreno/mcp/local-tools", () => ({
  handleLocalToolCall: async (name: string, args: Record<string, unknown>) => {
    return {content: [{text: `${name}:${JSON.stringify(args)}`, type: "text"}]};
  },
}));

import {describe, expect, it} from "bun:test";

import type {CliIo} from "../io";
import {runCli} from "../runCli";

const createIo = (): CliIo & {stderrLines: string[]; stdoutLines: string[]} => {
  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  return {
    cwd: "/tmp",
    env: {},
    fetch: (async () => new Response()) as unknown as typeof fetch,
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

describe("local project commands", () => {
  it("prints info, logs, and db output from local tools", async () => {
    const io = createIo();
    expect(await runCli(["info", "--json"], io)).toBe(0);
    expect(io.stdoutLines.join("\n")).toContain("application_info");
    io.stdoutLines.length = 0;
    expect(
      await runCli(["logs", "--entries", "5", "--level", "error", "--sources", "backend"], io)
    ).toBe(0);
    expect(io.stdoutLines.join("\n")).toContain("read_logs");
    io.stdoutLines.length = 0;
    expect(await runCli(["logs", "last-error", "--json"], io)).toBe(0);
    expect(io.stdoutLines.join("\n")).toContain("last_error");
    io.stdoutLines.length = 0;
    expect(await runCli(["db", "schema", "--collection-filter", "todo", "--summary"], io)).toBe(0);
    expect(io.stdoutLines.join("\n")).toContain("database_schema");
    io.stdoutLines.length = 0;
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
          "--limit",
          "2",
        ],
        io
      )
    ).toBe(0);
    expect(io.stdoutLines.join("\n")).toContain("database_query");
  });
});
