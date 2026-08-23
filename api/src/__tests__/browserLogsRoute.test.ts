import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import express from "express";
import supertest from "supertest";
import {addTerrenoDevBrowserLogsRoute} from "../browserLogsRoute";

describe("Terreno dev browser logs route", () => {
  let dir: string;
  let prevBrowserLogs: string | undefined;
  let prevEnv: NodeJS.ProcessEnv["NODE_ENV"] | undefined;
  let prevCwd: string;

  beforeEach(() => {
    prevCwd = process.cwd();
    prevEnv = process.env.NODE_ENV;
    prevBrowserLogs = process.env.TERRENO_BROWSER_LOGS;
    dir = mkdtempSync(join(tmpdir(), "terreno-browser-logs-"));
    process.chdir(dir);
  });

  afterEach(() => {
    process.chdir(prevCwd);
    process.env.NODE_ENV = prevEnv ?? "test";
    if (prevBrowserLogs === undefined) {
      Reflect.deleteProperty(process.env, "TERRENO_BROWSER_LOGS");
    } else {
      process.env.TERRENO_BROWSER_LOGS = prevBrowserLogs;
    }
    rmSync(dir, {force: true, recursive: true});
  });

  it("accepts POST batches in development and appends JSONL", async () => {
    process.env.NODE_ENV = "development";

    const app = express();
    addTerrenoDevBrowserLogsRoute(app);

    const res = await supertest(app)
      .post("/__terreno/browser-logs")
      .send({entries: [{level: "error", message: "from client"}]});

    expect(res.status).toBe(204);
    const p = join(dir, ".terreno", "logs", "browser.log");
    const txt = readFileSync(p, "utf-8");
    expect(txt).toContain("from client");
  });

  it("rejects batches over the entry cap", async () => {
    process.env.NODE_ENV = "development";

    const app = express();
    addTerrenoDevBrowserLogsRoute(app);

    const res = await supertest(app)
      .post("/__terreno/browser-logs")
      .send({entries: Array.from({length: 101}, () => ({level: "error", message: "x"}))});

    expect(res.status).toBe(413);
  });

  it("is not mounted outside development unless explicitly enabled", async () => {
    process.env.NODE_ENV = "test";

    const disabledApp = express();
    addTerrenoDevBrowserLogsRoute(disabledApp);
    const disabledResponse = await supertest(disabledApp)
      .post("/__terreno/browser-logs")
      .send({entries: [{level: "error", message: "x"}]});
    expect(disabledResponse.status).toBe(404);

    process.env.TERRENO_BROWSER_LOGS = "true";
    const enabledApp = express();
    addTerrenoDevBrowserLogsRoute(enabledApp);
    const enabledResponse = await supertest(enabledApp)
      .post("/__terreno/browser-logs")
      .send({entries: [{level: "error", message: "x"}]});
    expect(enabledResponse.status).toBe(204);
  });
});
