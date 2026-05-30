import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";
import type {Options} from "@wdio/types";

export const configDir = dirname(fileURLToPath(import.meta.url));
export const isCi = process.env.CI === "true";

export const sharedConfig: Options.Testrunner = {
  runner: "local",
  specs: [join(configDir, "specs/**/*.spec.ts")],
  maxInstances: 1,
  logLevel: "warn",
  bail: 0,
  waitforTimeout: 15000,
  connectionRetryTimeout: 300000,
  connectionRetryCount: 3,
  services: [
    [
      "appium",
      {
        args: {
          relaxedSecurity: true,
        },
        ...(isCi ? {startupTimeout: 180000} : {}),
      },
    ],
  ],
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 120000,
  },
};
