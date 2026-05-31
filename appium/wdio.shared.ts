import type {Options} from "@wdio/types";

const isCI = Boolean(process.env.CI);
const platform = process.env.APPIUM_PLATFORM ?? "web";

const webCapabilities: WebdriverIO.Capabilities = {
  browserName: "chrome",
  "appium:automationName": "chromium",
  "appium:chromedriverAutodownload": true,
  "goog:chromeOptions": {
    args: isCI
      ? ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
      : ["--disable-dev-shm-usage"],
  },
};

const iosCapabilities: WebdriverIO.Capabilities = {
  platformName: "iOS",
  "appium:automationName": "XCUITest",
  "appium:deviceName": process.env.SIMULATOR_DEVICE ?? "iPhone 16",
  "appium:bundleId": "com.terreno.todo",
  "appium:noReset": true,
};

export const sharedConfig: Options.Testrunner = {
  runner: "local",
  specs: ["./specs/**/*.spec.ts"],
  maxInstances: 1,
  capabilities: [platform === "ios" ? iosCapabilities : webCapabilities],
  services: [
    [
      "appium",
      {
        env: {
          APPIUM_HOME: process.env.APPIUM_HOME ?? `${process.env.HOME}/.appium-terreno`,
        },
      },
    ],
  ],
  port: 4723,
  logLevel: "warn",
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    timeout: 120000,
    ui: "bdd",
  },
  baseUrl: "http://localhost:8082",
};
