import {describe, expect, it} from "bun:test";
import type {ScriptContext} from "@terreno/api";

import type {AdminScriptConfig} from "./adminApp";
import {runScriptCli} from "./scriptCli";

const countScript: AdminScriptConfig = {
  args: [{default: "all", description: "Which collection to count", name: "model", type: "string"}],
  description: "Count records",
  name: "countRecords",
  runner: async (wetRun, ctx) => {
    const model = ctx?.args.getString("model", "all") ?? "all";
    return {results: [`mode=${wetRun ? "wet" : "dry"}`, `model=${model}`], success: true};
  },
};

const requiredArgScript: AdminScriptConfig = {
  args: [{description: "Email to target", name: "email", required: true}],
  description: "Needs an email",
  name: "needsEmail",
  runner: async (_wetRun, ctx) => ({
    results: [`email=${ctx?.args.getString("email") ?? ""}`],
    success: true,
  }),
};

const failingScript: AdminScriptConfig = {
  description: "Always throws",
  name: "boom",
  runner: async () => {
    throw new Error("kaboom");
  },
};

const unsuccessfulScript: AdminScriptConfig = {
  description: "Reports failure",
  name: "sad",
  runner: async () => ({results: ["nope"], success: false}),
};

const loggingScript: AdminScriptConfig = {
  description: "Logs via context",
  name: "logger",
  runner: async (_wetRun, ctx?: ScriptContext) => {
    await ctx?.checkCancellation();
    await ctx?.addLog("info", "hello");
    await ctx?.updateProgress(50, "halfway", "still going");
    return {results: ["logged"], success: true};
  },
};

const richArgsScript: AdminScriptConfig = {
  args: [
    {
      aliases: ["m"],
      default: "all",
      description: "Which model",
      example: "todos",
      name: "model",
      type: "string",
    },
  ],
  description: "Has a rich arg",
  name: "rich",
  runner: async (_wetRun, ctx) => ({
    results: [`model=${ctx?.args.getString("model")}`],
    success: true,
  }),
};

const allScripts = [
  countScript,
  requiredArgScript,
  failingScript,
  unsuccessfulScript,
  loggingScript,
  richArgsScript,
];

/** Runs the CLI capturing output, never exiting the process. */
const run = async (argv: string[], scripts = allScripts) => {
  const lines: string[] = [];
  const result = await runScriptCli({
    argv,
    exit: false,
    scripts,
    write: (line) => lines.push(line),
  });
  return {lines, output: lines.join("\n"), result};
};

describe("runScriptCli", () => {
  it("prints general help and lists scripts when no script is given", async () => {
    const {output, result} = await run([]);
    expect(result.exitCode).toBe(0);
    expect(output).toInclude("Available scripts:");
    expect(output).toInclude("countRecords");
  });

  it("lists scripts with --list", async () => {
    const {output, result} = await run(["--list"]);
    expect(result.exitCode).toBe(0);
    expect(output).toInclude("countRecords");
  });

  it("prints general help with --help and no script", async () => {
    const {output, result} = await run(["--help"]);
    expect(result.exitCode).toBe(0);
    expect(output).toInclude("Available scripts:");
  });

  it("shows aliases and examples in per-script help", async () => {
    const {output, result} = await run(["rich", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(output).toInclude("(-m)");
    expect(output).toInclude("(e.g. todos)");
    expect(output).toInclude("(default: all)");
  });

  it("notes when no scripts are registered", async () => {
    const {output} = await run(["--list"], []);
    expect(output).toInclude("No scripts are registered.");
  });

  it("returns an error for an unknown script", async () => {
    const {output, result} = await run(["doesNotExist"]);
    expect(result.exitCode).toBe(1);
    expect(result.success).toBe(false);
    expect(output).toInclude("Unknown script: doesNotExist");
  });

  it("prints per-script help including declared args", async () => {
    const {output, result} = await run(["countRecords", "--help"]);
    expect(result.exitCode).toBe(0);
    expect(output).toInclude("--model");
    expect(output).toInclude("Which collection to count");
  });

  it("runs as a dry run by default", async () => {
    const {result} = await run(["countRecords"]);
    expect(result.success).toBe(true);
    expect(result.wetRun).toBe(false);
    expect(result.results).toContain("mode=dry");
    expect(result.results).toContain("model=all");
  });

  it("runs in wet mode with --wet", async () => {
    const {result} = await run(["countRecords", "--wet"]);
    expect(result.wetRun).toBe(true);
    expect(result.results).toContain("mode=wet");
  });

  it("lets --dry override --wet", async () => {
    const {result} = await run(["countRecords", "--wet", "--dry"]);
    expect(result.wetRun).toBe(false);
    expect(result.results).toContain("mode=dry");
  });

  it("forwards declared args to the runner", async () => {
    const {result} = await run(["countRecords", "--model", "todos"]);
    expect(result.results).toContain("model=todos");
  });

  it("does not leak reserved flags into script args", async () => {
    const seen: Record<string, unknown> = {};
    const spyScript: AdminScriptConfig = {
      description: "spy",
      name: "spy",
      runner: async (_wetRun, ctx) => {
        Object.assign(seen, ctx?.args.raw);
        return {results: ["ok"], success: true};
      },
    };
    await run(["spy", "--wet", "--json", "--keep=yes"], [spyScript]);
    expect(seen.wet).toBeUndefined();
    expect(seen.json).toBeUndefined();
    expect(seen.keep).toBe("yes");
  });

  it("errors when a declared value flag is missing its value", async () => {
    const {output, result} = await run(["countRecords", "--model"]);
    expect(result.exitCode).toBe(1);
    expect(result.success).toBe(false);
    expect(output).toInclude("--model expects a string value");
  });

  it("fails when a required argument is missing", async () => {
    const {output, result} = await run(["needsEmail"]);
    expect(result.exitCode).toBe(1);
    expect(result.success).toBe(false);
    expect(output).toInclude("Missing required argument: --email");
    expect(output).toInclude("Usage:");
  });

  it("accepts a provided required argument", async () => {
    const {result} = await run(["needsEmail", "--email", "a@b.com"]);
    expect(result.success).toBe(true);
    expect(result.results).toContain("email=a@b.com");
  });

  it("returns a non-zero exit when the script throws", async () => {
    const {output, result} = await run(["boom"]);
    expect(result.exitCode).toBe(1);
    expect(result.errors).toContain("kaboom");
    expect(output).toInclude("Error: kaboom");
  });

  it("returns a non-zero exit when the script reports failure", async () => {
    const {output, result} = await run(["sad"]);
    expect(result.exitCode).toBe(1);
    expect(result.success).toBe(false);
    expect(output).toInclude("Script reported failure.");
  });

  it("emits a JSON line in --json mode", async () => {
    const {lines, result} = await run(["countRecords", "--json", "--model", "users"]);
    expect(result.success).toBe(true);
    const jsonLine = lines.find((line) => line.startsWith("{"));
    expect(jsonLine).toBeDefined();
    const parsed = JSON.parse(jsonLine as string);
    expect(parsed.script).toBe("countRecords");
    expect(parsed.results).toContain("model=users");
  });

  it("emits JSON on error in --json mode", async () => {
    const {lines, result} = await run(["boom", "--json"]);
    expect(result.exitCode).toBe(1);
    const jsonLine = lines.find((line) => line.startsWith("{"));
    const parsed = JSON.parse(jsonLine as string);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe("kaboom");
  });

  it("routes context logs and progress to output (non-json)", async () => {
    const {output} = await run(["logger"]);
    expect(output).toInclude("[info] hello");
    expect(output).toInclude("[progress] 50%");
    expect(output).toInclude("halfway");
  });

  it("suppresses context logs in --json mode", async () => {
    const {output} = await run(["logger", "--json"]);
    expect(output).not.toInclude("[info] hello");
    expect(output).not.toInclude("[progress]");
  });
});
