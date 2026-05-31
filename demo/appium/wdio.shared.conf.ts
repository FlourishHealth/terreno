import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

export const configDir = dirname(fileURLToPath(import.meta.url));
export const isCi = process.env.CI === "true";

export const sharedConfig: Omit<WebdriverIO.Config, "capabilities"> = {
  runner: "local",
  specs: [join(configDir, "specs/**/*.spec.ts")],
  maxInstances: 1,
  specFileRetries: isCi ? 1 : 0,
  logLevel: "warn",
  bail: 0,
  waitforTimeout: 15000,
  connectionRetryTimeout: isCi ? 600000 : 300000,
  connectionRetryCount: isCi ? 2 : 3,
  services: [
    [
      "appium",
      {
        args: {
          relaxedSecurity: true,
        },
        ...(isCi ? {startupTimeout: 600000} : {}),
      },
    ],
  ],
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: isCi ? 300000 : 120000,
  },
};
