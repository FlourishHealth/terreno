import {defineConfig, devices} from "@playwright/test";

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      dependencies: ["setup"],
      name: "chromium",
      use: {...devices["Desktop Chrome"]},
    },
  ],
  reporter: process.env.CI ? [["github"], ["html", {open: "never"}]] : "html",
  retries: process.env.CI ? 2 : 0,
  testDir: "./e2e",
  use: {
    baseURL: "http://localhost:8082",
    navigationTimeout: 60000,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "on-first-retry",
  },
  webServer: [
    {
      // In CI the backend is started explicitly by the workflow before playwright runs.
      // reuseExistingServer: true lets playwright use it instead of starting a second instance.
      command: "bun --cwd ../example-backend run src/index.ts",
      env: {
        MONGO_URI: process.env.MONGO_URI ?? "mongodb://127.0.0.1/terreno-e2e",
        PORT: "4000",
        REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET ?? "e2e-refresh-secret-dev",
        SESSION_SECRET: process.env.SESSION_SECRET ?? "e2e-session-secret-dev",
        TOKEN_ISSUER: process.env.TOKEN_ISSUER ?? "terreno-e2e",
        TOKEN_SECRET: process.env.TOKEN_SECRET ?? "e2e-token-secret-dev",
      },
      port: 4000,
      reuseExistingServer: true,
    },
    {
      command: "bun run web",
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000,
      url: "http://localhost:8082",
    },
  ],
  workers: 1,
});
