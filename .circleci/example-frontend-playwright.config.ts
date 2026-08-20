import path from "node:path";
import {fileURLToPath} from "node:url";
import type {PlaywrightTestConfig} from "@playwright/test";
import baseConfig from "../example-frontend/playwright.config";

const frontendRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../example-frontend",
);

const webServers = Array.isArray(baseConfig.webServer)
  ? baseConfig.webServer
  : baseConfig.webServer
    ? [baseConfig.webServer]
    : [];

/**
 * CircleCI overlay: reuse a pre-started Expo web server and allow 60s per test.
 * Do not change example-frontend/playwright.config.ts for this — that path
 * fans out the GitHub Actions e2e matrix.
 */
const circleCiPlaywrightConfig: PlaywrightTestConfig = {
  ...baseConfig,
  outputDir: path.join(frontendRoot, "test-results"),
  reporter: [
    ["list"],
    ["html", {open: "never", outputFolder: path.join(frontendRoot, "playwright-report")}],
  ],
  testDir: path.join(frontendRoot, "e2e"),
  timeout: 60_000,
  webServer: webServers.map((server) => {
    return {
      ...server,
      reuseExistingServer: true,
    };
  }),
};

export default circleCiPlaywrightConfig;
