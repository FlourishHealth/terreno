import {defineConfig, devices} from "@playwright/test";

const BACKEND_URL = process.env.ADMIN_SPA_BACKEND_URL ?? "http://localhost:4000";

/**
 * Playwright config for the full-stack integration e2e. Unlike the default config,
 * there is no managed webServer: the example-backend must already be running with
 * ADMIN_SPA_ENABLED=true and AUTH_PROVIDER=better-auth, serving the pre-built SPA
 * at /console, with the admin user seeded via
 * `bun run src/scripts/seed-admin-spa-admin.ts` (in example-backend).
 *
 * Run with: bunx playwright test --config playwright.integration.config.ts
 */
export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  // Tests share a single seeded backend, so run them serially.
  fullyParallel: false,
  projects: [{name: "chromium", use: {...devices["Desktop Chrome"]}}],
  reporter: process.env.CI ? "list" : "html",
  retries: process.env.CI ? 1 : 0,
  testDir: "./e2e/integration",
  testMatch: "**/*.spec.ts",
  use: {
    baseURL: BACKEND_URL,
    trace: "on-first-retry",
  },
  workers: 1,
});
