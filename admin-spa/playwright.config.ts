import {defineConfig, devices} from "@playwright/test";

const PORT = Number(process.env.PORT ?? 4100);

/**
 * Playwright e2e config for the admin SPA. Boots the backend-free `serveTestApp`
 * (serves the pre-built dist/ + app-config.json) and drives a real browser through
 * the anonymous -> login flow. Run `bun run build:web` before `bun run test:e2e`.
 */
export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  projects: [{name: "chromium", use: {...devices["Desktop Chrome"]}}],
  reporter: process.env.CI ? "list" : "html",
  retries: process.env.CI ? 1 : 0,
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `PORT=${PORT} bun e2e/serveTestApp.ts`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    url: `http://localhost:${PORT}/console/app-config.json`,
  },
});
