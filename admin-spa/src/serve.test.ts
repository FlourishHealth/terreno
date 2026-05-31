import {afterAll, beforeAll, describe, expect, it} from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import {DEFAULT_APP_CONFIG} from "./appConfig";
import {AdminSpaServeApp, rewriteIndexHtml} from "./serve";

const STUB_INDEX =
  '<html><head><link href="/_expo/static/css/app.css"><script src="/_expo/static/js/web/entry.js"></script></head><body>STUB-SPA</body></html>';
const STUB_ASSET = "CONTENT";

let distDir: string;

beforeAll(() => {
  distDir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-spa-dist-"));
  fs.writeFileSync(path.join(distDir, "index.html"), STUB_INDEX);
  const expoJsDir = path.join(distDir, "_expo", "static", "js", "web");
  fs.mkdirSync(expoJsDir, {recursive: true});
  fs.writeFileSync(path.join(expoJsDir, "foo.abc123.js"), STUB_ASSET);
  const assetsDir = path.join(distDir, "assets");
  fs.mkdirSync(assetsDir, {recursive: true});
  fs.writeFileSync(path.join(assetsDir, "logo.png"), STUB_ASSET);
});

afterAll(() => {
  fs.rmSync(distDir, {force: true, recursive: true});
});

const makeApp = (opts?: {
  basePath?: string;
  appConfig?: Record<string, unknown>;
}): express.Application => {
  const app = express();
  new AdminSpaServeApp({
    appConfig: opts?.appConfig,
    basePath: opts?.basePath,
    distDir,
  }).register(app);
  // A fallthrough 404 so requests outside basePath resolve.
  app.use((_req, res) => res.status(404).send("not found"));
  return app;
};

describe("rewriteIndexHtml", () => {
  it("rewrites absolute /_expo/ and /assets/ refs to the basePath", () => {
    const out = rewriteIndexHtml(STUB_INDEX, "/console");
    expect(out).toContain('href="/console/_expo/static/css/app.css"');
    expect(out).toContain('src="/console/_expo/static/js/web/entry.js"');
    expect(out).not.toContain('href="/_expo/');
  });

  it("rewrites assets references too", () => {
    const out = rewriteIndexHtml('<img src="/assets/logo.png">', "/admin-ui");
    expect(out).toContain('src="/admin-ui/assets/logo.png"');
  });
});

describe("AdminSpaServeApp", () => {
  it("serves the SPA at the base path with no-store HTML", async () => {
    const res = await request(makeApp()).get("/console/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("STUB-SPA");
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("serves the SPA at the bare base path (no trailing slash)", async () => {
    const res = await request(makeApp()).get("/console");
    expect(res.status).toBe(200);
    expect(res.text).toContain("STUB-SPA");
  });

  it("falls back to index.html for deep SPA routes", async () => {
    const res = await request(makeApp()).get("/console/users/abc123");
    expect(res.status).toBe(200);
    expect(res.text).toContain("STUB-SPA");
  });

  it("rewrites asset references in the served HTML", async () => {
    const res = await request(makeApp()).get("/console/");
    expect(res.text).toContain('src="/console/_expo/static/js/web/entry.js"');
  });

  it("serves hashed assets with an immutable long-lived cache header", async () => {
    const res = await request(makeApp()).get("/console/_expo/static/js/web/foo.abc123.js");
    expect(res.status).toBe(200);
    expect(res.text).toBe(STUB_ASSET);
    expect(res.headers["cache-control"]).toContain("max-age=31536000");
    expect(res.headers["cache-control"]).toContain("immutable");
  });

  it("serves app-config.json with defaults and no-store", async () => {
    const res = await request(makeApp()).get("/console/app-config.json");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.brandName).toBe(DEFAULT_APP_CONFIG.brandName);
    expect(res.body.primaryColor).toBe("#2563EB");
    expect(res.body.providers).toEqual(["email"]);
  });

  it("merges provided app-config over the defaults field-by-field", async () => {
    const res = await request(
      makeApp({appConfig: {brandName: "Acme Admin", providers: ["email", "google"]}})
    ).get("/console/app-config.json");
    expect(res.body.brandName).toBe("Acme Admin");
    expect(res.body.providers).toEqual(["email", "google"]);
    // Untouched field keeps its default.
    expect(res.body.primaryColor).toBe("#2563EB");
  });

  it("honors a custom basePath", async () => {
    const app = makeApp({basePath: "/admin-ui"});
    const spa = await request(app).get("/admin-ui/");
    expect(spa.status).toBe(200);
    expect(spa.text).toContain("STUB-SPA");
    const config = await request(app).get("/admin-ui/app-config.json");
    expect(config.status).toBe(200);
    expect(config.body.brandName).toBe(DEFAULT_APP_CONFIG.brandName);
  });

  it("does not handle requests outside the base path", async () => {
    const res = await request(makeApp()).get("/unrelated");
    expect(res.status).toBe(404);
  });
});
