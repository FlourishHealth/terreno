import path from "node:path";
import express from "express";
import {AdminSpaServeApp} from "../src/serve";

// Pre-built bundle lives at admin-spa/dist. Resolved explicitly (rather than relying on
// the plugin's compiled-location default) so the e2e works when run from TS source.
const DIST_DIR = path.resolve(__dirname, "../dist");

/**
 * Minimal Express app that serves the pre-built admin SPA via `AdminSpaServeApp`.
 * No database or backend is required: the plugin serves the static bundle and
 * `app-config.json`, and the SPA treats the absent `/api/auth/*` routes as "logged
 * out", so it renders the login screen. Used by the smoke check and Playwright e2e.
 */
export const createTestApp = (): express.Express => {
  const app = express();
  const plugin = new AdminSpaServeApp({
    appConfig: {
      brandName: "Terreno Admin (e2e)",
      primaryColor: "#2563EB",
      providers: ["email", "google"],
    },
    basePath: "/console",
    distDir: DIST_DIR,
  });
  plugin.register(app);
  return app;
};

// Run directly (e.g. `bun e2e/serveTestApp.ts`) to start the server for Playwright.
if (import.meta.main) {
  const port = Number(process.env.PORT ?? 4100);
  createTestApp().listen(port, () => {
    console.info(`[admin-spa e2e] serving SPA at http://localhost:${port}/console/`);
  });
}
