import {defineConfig, devices} from "@playwright/test";
import baseConfig from "./playwright.config";

const proofOutputDir = process.env.PROOF_OUTPUT_DIR ?? ".proof/playwright";

export default defineConfig({
  ...baseConfig,
  outputDir: `${proofOutputDir}/test-results`,
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
  reporter: [["list"], ["html", {open: "never", outputFolder: `${proofOutputDir}/report`}]],
  retries: 0,
  use: {
    ...baseConfig.use,
    screenshot: "on",
    trace: "on",
    video: "on",
  },
});
