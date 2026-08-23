import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {DateTime} from "luxon";

import {resolveTerrenoLogDirs} from "./logPaths";
import {resolveMetroHttpBase} from "./metro/metroDevSession";
import {lastError, readLogs} from "./tools/readLogs";
import {evaluate, getRtkState, navigate} from "./tools/runtime";

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
    const browserTimestamp = DateTime.fromISO(timestamp).plus({milliseconds: 1}).toISO();
    writeFileSync(
      join(backendLogDir, "app.log"),
      `${JSON.stringify({level: "info", message: "backend ready", timestamp})}\n`
    );
    writeFileSync(
      join(backendLogDir, "browser.log"),
      `${JSON.stringify({level: "error", message: "client failed", timestamp: browserTimestamp})}\n`
    );

    const result = JSON.parse(await readLogs({entries: 10, sources: ["backend", "browser"]})) as {
      entries: Array<{message?: string}>;
    };
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
          mutations: {
            updateTodo: {
              endpointName: "updateTodo",
              originalArgs: {id: "todo-1"},
              status: "pending",
            },
          },
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
    const noMatch = JSON.parse(await getRtkState({query: "missing", slice: "rtk"})) as {
      mutations: unknown[];
      queries: unknown[];
    };
    expect(noMatch).toEqual({mutations: [], queries: []});
    expect(JSON.parse(await getRtkState({slice: "auth"}))).toEqual({
      auth: {userId: "user-1"},
    });
    expect(JSON.parse(await getRtkState({slice: "custom"}))).toEqual({});
    expect(JSON.parse(await getRtkState({}))).toMatchObject({
      auth: {userId: "user-1"},
    });
    expect(await evaluate({code: "1 + 1"})).toContain("Refused");
    expect(await navigate({path: "/profile"})).toContain("Refused");

    process.env.TERRENO_MCP_EVAL = "1";
    expect(await evaluate({code: "  "})).toBe("No code provided.");
    expect(await navigate({path: "  "})).toBe("No path provided.");

    devGlobal.__TERRENO_STORE__ = {
      getState: (): Record<string, unknown> => ({auth: {userId: "user-1"}}),
    };
    expect(JSON.parse(await getRtkState({slice: "rtk"}))).toEqual({
      note: "No terreno-rtk slice found on store.",
    });
  });

  it("filters durable logs by time and level and reports no error", async (): Promise<void> => {
    const rootLogDir = join(projectRoot, ".terreno", "logs");
    mkdirSync(rootLogDir, {recursive: true});
    const threshold = DateTime.utc();
    writeFileSync(
      join(rootLogDir, "app.log"),
      [
        JSON.stringify({
          level: "error",
          message: "old failure",
          timestamp: threshold.minus({minutes: 1}).toISO(),
        }),
        "plain line without timestamp",
        JSON.stringify({
          level: "info",
          message: "new info",
          timestamp: threshold.plus({milliseconds: 1}).toISO(),
        }),
      ].join("\n")
    );

    const filtered = JSON.parse(
      await readLogs({
        level: "info",
        since: threshold.toISO(),
        sources: ["backend"],
      })
    ) as {entries: Array<{message?: string}>};
    expect(filtered.entries).toHaveLength(1);
    expect(filtered.entries[0]?.message).toBe("new info");
    expect(await lastError({sources: ["backend"]})).toContain("old failure");
    expect(await lastError({sources: ["browser"]})).toContain("No recent error-level entries");
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
