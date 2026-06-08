import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

export const configDir = dirname(fileURLToPath(import.meta.url));
export const isCi = process.env.CI === "true";
const isQuickLoop = process.env.APPIUM_QUICK_LOOP === "true";
const isIosRun = process.argv.some((value) => value.includes("wdio.ios.conf"));
const appiumLogPath = join(configDir, "..", "logs");

const parseEnvNumber = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  return parsed;
};

const resolvedSpecs =
  process.env.APPIUM_SPECS
    ?.split(",")
    .map((spec) => spec.trim())
    .filter(Boolean)
    .map((spec) => join(configDir, spec)) ?? [join(configDir, "specs/**/*.spec.ts")];

const configuredSpecFileRetries = parseEnvNumber(process.env.APPIUM_SPEC_FILE_RETRIES);
const specFileRetries = configuredSpecFileRetries ?? (isQuickLoop ? 0 : isCi ? 1 : 0);
const quickLoopConnectionRetryTimeout = isIosRun ? 240000 : 120000;

export const sharedConfig: Omit<WebdriverIO.Config, "capabilities"> = {
  runner: "local",
  specs: resolvedSpecs,
  maxInstances: 1,
  specFileRetries,
  logLevel: "warn",
  bail: 0,
  waitforTimeout: isQuickLoop ? 10000 : 15000,
  connectionRetryTimeout: isQuickLoop
    ? quickLoopConnectionRetryTimeout
    : isCi
      ? 600000
      : 300000,
  connectionRetryCount: isQuickLoop ? 1 : isCi ? 2 : 3,
  services: [
    [
      "appium",
      {
        logPath: appiumLogPath,
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
    timeout: isQuickLoop ? 180000 : isCi ? 300000 : 120000,
  },
};
