import {appendFileSync, existsSync} from "node:fs";

import {isCi, sharedConfig} from "./wdio.shared.conf";

const iosAppPath = process.env.IOS_APP_PATH;
const iosAppPathExists = iosAppPath ? existsSync(iosAppPath) : false;

try {
  // #region agent log
  appendFileSync(
    "/opt/cursor/logs/debug.log",
    `${JSON.stringify({
      hypothesisId: "H3",
      location: "demo/appium/wdio.ios.conf.ts:8",
      message: "Resolved IOS_APP_PATH state",
      data: {
        iosAppPath,
        iosAppPathExists,
      },
      timestamp: Date.now(),
    })}\n`
  );
  // #endregion
} catch {}

if (!iosAppPath || !iosAppPathExists) {
  try {
    // #region agent log
    appendFileSync(
      "/opt/cursor/logs/debug.log",
      `${JSON.stringify({
        hypothesisId: "H3",
        location: "demo/appium/wdio.ios.conf.ts:25",
        message: "Failing due to missing IOS_APP_PATH bundle",
        data: {
          iosAppPath,
          iosAppPathExists,
        },
        timestamp: Date.now(),
      })}\n`
    );
    // #endregion
  } catch {}

  throw new Error(
    "Set IOS_APP_PATH to a built iOS simulator .app bundle. Build with xcodebuild for iphonesimulator first."
  );
}

const iosPlatformVersion = process.env.IOS_PLATFORM_VERSION;
const iosDeviceUdid = process.env.IOS_DEVICE_UDID;
const iosCapabilities: Record<string, unknown> = {
  platformName: "iOS",
  "appium:automationName": "XCUITest",
  "appium:deviceName": process.env.IOS_DEVICE_NAME ?? "iPhone 16",
  ...(iosPlatformVersion ? {"appium:platformVersion": iosPlatformVersion} : {}),
  ...(iosDeviceUdid ? {"appium:udid": iosDeviceUdid} : {}),
  "appium:app": iosAppPath,
  "appium:autoAcceptAlerts": true,
  "appium:appWaitDuration": 60000,
  "appium:newCommandTimeout": 240,
  ...(isCi
    ? {
        "appium:showXcodeLog": true,
        "appium:appLaunchTimeout": 180000,
        "appium:wdaLaunchTimeout": 360000,
        "appium:wdaConnectionTimeout": 360000,
        "appium:wdaStartupRetries": 4,
        "appium:wdaStartupRetryInterval": 20000,
        "appium:simulatorStartupTimeout": 240000,
      }
    : {}),
};

try {
  // #region agent log
  appendFileSync(
    "/opt/cursor/logs/debug.log",
    `${JSON.stringify({
      hypothesisId: "H2",
      location: "demo/appium/wdio.ios.conf.ts:67",
      message: "Resolved iOS Appium capabilities",
      data: {
        deviceName: iosCapabilities["appium:deviceName"],
        platformVersion: iosCapabilities["appium:platformVersion"] ?? null,
        simulatorStartupTimeout: iosCapabilities["appium:simulatorStartupTimeout"] ?? null,
        udid: iosCapabilities["appium:udid"] ?? null,
        wdaConnectionTimeout: iosCapabilities["appium:wdaConnectionTimeout"] ?? null,
        wdaLaunchTimeout: iosCapabilities["appium:wdaLaunchTimeout"] ?? null,
      },
      timestamp: Date.now(),
    })}\n`
  );
  // #endregion
} catch {}

export const config: WebdriverIO.Config = {
  ...sharedConfig,
  capabilities: [iosCapabilities],
};
