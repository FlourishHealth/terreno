import {afterAll, beforeAll, describe, expect, it} from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import supertest from "supertest";

import {start} from "./server";

const FIXTURE_INDEX_HTML =
  '<html><head><link href="/_expo/static/app.css" rel="stylesheet"></head>' +
  "<body>console-dist-dir-fixture</body></html>";

/**
 * Covers the ADMIN_SPA_DIST_DIR override used by compiled deploys (Cloud Run), where
 * the serve plugin's __dirname-relative bundle resolution cannot work. The server must
 * serve the export from the configured directory at /console.
 */
describe("admin SPA serving with ADMIN_SPA_DIST_DIR", () => {
  let fixtureDistDir: string;

  beforeAll(() => {
    fixtureDistDir = fs.mkdtempSync(path.join(os.tmpdir(), "admin-spa-dist-"));
    fs.writeFileSync(path.join(fixtureDistDir, "index.html"), FIXTURE_INDEX_HTML);
  });

  afterAll(() => {
    fs.rmSync(fixtureDistDir, {force: true, recursive: true});
  });

  it("serves the SPA from the configured dist directory", async () => {
    process.env.ADMIN_SPA_ENABLED = "true";
    process.env.ADMIN_SPA_DIST_DIR = fixtureDistDir;

    const app = await start(true);
    const server = supertest(app);

    const indexRes = await server.get("/console").expect(200);
    expect(indexRes.text).toContain("console-dist-dir-fixture");
    // Asset refs are rewritten to the mount path and the base global is injected.
    expect(indexRes.text).toContain('href="/console/_expo/static/app.css"');
    expect(indexRes.text).toContain('window.__ADMIN_SPA_BASE__="/console"');

    // Deep routes fall back to the same index.html.
    const deepRes = await server.get("/console/some/deep/route").expect(200);
    expect(deepRes.text).toContain("console-dist-dir-fixture");

    const configRes = await server.get("/console/app-config.json").expect(200);
    expect(configRes.body.brandName).toBe("Terreno Example");
  });

  it("does not mount /console when the flag is disabled", async () => {
    process.env.ADMIN_SPA_ENABLED = "false";

    const app = await start(true);
    const server = supertest(app);

    await server.get("/console").expect(404);
  });
});
