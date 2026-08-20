import type {PlaywrightTestConfig} from "@playwright/test";
import baseConfig from "./playwright.config";

const webServers = Array.isArray(baseConfig.webServer)
  ? baseConfig.webServer
  : baseConfig.webServer
    ? [baseConfig.webServer]
    : [];

/**
 * CircleCI overlay: reuse a pre-started Expo web server and allow 60s per test.
 * Keep this out of playwright.config.ts — that path fans out the GHA e2e matrix.
 */
const circleCiPlaywrightConfig: PlaywrightTestConfig = {
  ...baseConfig,
  reporter: [["list"], ["html", {open: "never"}]],
  timeout: 60_000,
  webServer: webServers.map((server) => {
    return {
      ...server,
      reuseExistingServer: true,
    };
  }),
};

export default circleCiPlaywrightConfig;
