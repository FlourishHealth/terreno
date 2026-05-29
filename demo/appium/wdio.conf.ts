import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import type {Options} from "@wdio/types";

const configDir = dirname(fileURLToPath(import.meta.url));
const demoBaseUrl = process.env.DEMO_BASE_URL ?? "http://localhost:8085";
const isCi = process.env.CI === "true";

const chromeBinary =
  process.env.CHROME_BINARY ?? "/usr/bin/google-chrome-stable";

export const config: Options.Testrunner = {
  runner: "local",
  specs: [join(configDir, "specs/**/*.spec.ts")],
  maxInstances: 1,
  capabilities: [
    {
      platformName: "linux",
      browserName: "chrome",
      "appium:automationName": "Chromium",
      "appium:chromedriverAutodownload": true,
      "goog:chromeOptions": {
        binary: chromeBinary,
        args: isCi ? ["headless=new", "--no-sandbox", "--disable-dev-shm-usage"] : [],
      },
    },
  ],
  logLevel: "warn",
  bail: 0,
  baseUrl: demoBaseUrl,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: [
    [
      "appium",
      {
        args: {
          relaxedSecurity: true,
        },
      },
    ],
  ],
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },
};
