import {afterEach, beforeEach, describe, expect, it} from "bun:test";
import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import express from "express";
import supertest from "supertest";
import {addTerrenoDevBrowserLogsRoute} from "../browserLogsRoute";

/** Run with `BUN_TEST_DISABLE_DB=true` so `bunSetup` skips Mongo (`bun test` still preloads it). */

describe("Terreno dev browser logs route", () => {
  let prevEnv: NodeJS.ProcessEnv["NODE_ENV"] | undefined;
  let prevCwd: string;

  beforeEach(() => {
    prevCwd = process.cwd();
    prevEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.chdir(prevCwd);
    process.env.NODE_ENV = prevEnv ?? "test";
  });

  it("accepts POST batches in development and appends JSONL", async () => {
    process.env.NODE_ENV = "development";
    const dir = mkdtempSync(join(tmpdir(), "terreno-browser-logs-"));
    process.chdir(dir);

    const app = express();
    app.use(express.json());
    addTerrenoDevBrowserLogsRoute(app);

    const res = await supertest(app)
      .post("/__terreno/browser-logs")
      .send({entries: [{level: "error", message: "from client"}]});

    expect(res.status).toBe(204);
    const p = join(dir, ".terreno", "logs", "browser.log");
    const txt = readFileSync(p, "utf-8");
    expect(txt).toContain("from client");
    rmSync(dir, {force: true, recursive: true});
  });

  it("is not mounted in production", async () => {
    process.env.NODE_ENV = "production";
    const dir = mkdtempSync(join(tmpdir(), "terreno-browser-logs-"));
    process.chdir(dir);

    const app = express();
    app.use(express.json());
    addTerrenoDevBrowserLogsRoute(app);

    const res = await supertest(app)
      .post("/__terreno/browser-logs")
      .send({entries: [{level: "error", message: "x"}]});

    expect(res.status).toBe(404);
    rmSync(dir, {force: true, recursive: true});
  });
});
