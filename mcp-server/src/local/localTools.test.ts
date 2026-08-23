import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DateTime} from "luxon";

import {resolveTerrenoLogDirs} from "./logPaths";
import {resolveMetroHttpBase} from "./metro/metroDevSession";
import {lastError, readLogs} from "./tools/readLogs";
import {evaluate, getRtkState} from "./tools/runtime";

describe("local MCP runtime tools", () => {
  let projectRoot: string;
  let previousEval: string | undefined;
  let previousMetroUrl: string | undefined;
  let previousProjectRoot: string | undefined;

  beforeEach((): void => {
    projectRoot = mkdtempSync(join(tmpdir(), "terreno-local-tools-"));
    previousEval = process.env.TERRENO_MCP_EVAL;
    previousMetroUrl = process.env.TERRENO_METRO_URL;
    previousProjectRoot = process.env.TERRENO_PROJECT_ROOT;
    process.env.TERRENO_PROJECT_ROOT = projectRoot;
    Reflect.deleteProperty(process.env, "TERRENO_MCP_EVAL");
    Reflect.deleteProperty(process.env, "TERRENO_METRO_URL");
  });

  afterEach((): void => {
    rmSync(projectRoot, {force: true, recursive: true});
    const devGlobal = globalThis as typeof globalThis & {__TERRENO_STORE__?: unknown};
    Reflect.deleteProperty(devGlobal, "__TERRENO_STORE__");
    if (previousEval === undefined) {
      Reflect.deleteProperty(process.env, "TERRENO_MCP_EVAL");
    } else {
      process.env.TERRENO_MCP_EVAL = previousEval;
    }
    if (previousMetroUrl === undefined) {
      Reflect.deleteProperty(process.env, "TERRENO_METRO_URL");
    } else {
      process.env.TERRENO_METRO_URL = previousMetroUrl;
    }
    if (previousProjectRoot === undefined) {
      Reflect.deleteProperty(process.env, "TERRENO_PROJECT_ROOT");
    } else {
      process.env.TERRENO_PROJECT_ROOT = previousProjectRoot;
    }
  });

  it("discovers bootstrap, example, and root log directories", (): void => {
    expect(resolveTerrenoLogDirs()).toEqual([
      join(projectRoot, "backend", ".terreno", "logs"),
      join(projectRoot, "example-backend", ".terreno", "logs"),
      join(projectRoot, ".terreno", "logs"),
    ]);
  });

  it("merges example-backend and browser JSONL logs", async (): Promise<void> => {
    const backendLogDir = join(projectRoot, "example-backend", ".terreno", "logs");
    mkdirSync(backendLogDir, {recursive: true});
    const timestamp = DateTime.utc().toISO();
    writeFileSync(
      join(backendLogDir, "app.log"),
      `${JSON.stringify({level: "info", message: "backend ready", timestamp})}\n`
    );
    writeFileSync(
      join(backendLogDir, "browser.log"),
      `${JSON.stringify({level: "error", message: "client failed", timestamp})}\n`
    );

    const result = JSON.parse(
      await readLogs({entries: 10, sources: ["backend", "browser"]})
    ) as {entries: Array<{message?: string}>};
    expect(result.entries.map((entry) => entry.message)).toEqual([
      "backend ready",
      "client failed",
    ]);

    const latest = JSON.parse(await lastError({sources: ["browser"]})) as {message?: string};
    expect(latest.message).toBe("client failed");
  });

  it("reads local RTK state and keeps evaluate opt-in", async (): Promise<void> => {
    const devGlobal = globalThis as typeof globalThis & {
      __TERRENO_STORE__?: {getState: () => Record<string, unknown>};
    };
    devGlobal.__TERRENO_STORE__ = {
      getState: (): Record<string, unknown> => ({
        auth: {userId: "user-1"},
        "terreno-rtk": {
          mutations: {},
          queries: {
            todos: {endpointName: "getTodos", originalArgs: {}, status: "fulfilled"},
          },
        },
      }),
    };

    const state = JSON.parse(await getRtkState({query: "todo", slice: "rtk"})) as {
      queries: Array<{endpoint?: string}>;
    };
    expect(state.queries[0]?.endpoint).toBe("getTodos");
    expect(await evaluate({code: "1 + 1"})).toContain("Refused");
  });

  it("resolves Metro from explicit URL or frontend scripts", (): void => {
    process.env.TERRENO_METRO_URL = "https://metro.example.test/";
    expect(resolveMetroHttpBase()).toBe("https://metro.example.test");

    Reflect.deleteProperty(process.env, "TERRENO_METRO_URL");
    const frontendDir = join(projectRoot, "frontend");
    mkdirSync(frontendDir, {recursive: true});
    writeFileSync(
      join(frontendDir, "package.json"),
      JSON.stringify({scripts: {web: "expo start --web --port 9090"}})
    );
    expect(resolveMetroHttpBase()).toBe("http://localhost:9090");
  });
});
