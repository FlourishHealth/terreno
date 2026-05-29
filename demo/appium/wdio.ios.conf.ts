import {existsSync} from "node:fs";
import type {Options} from "@wdio/types";

import {isCi, sharedConfig} from "./wdio.shared.conf";

const iosAppPath = process.env.IOS_APP_PATH;

if (!iosAppPath || !existsSync(iosAppPath)) {
  throw new Error(
    "Set IOS_APP_PATH to a built iOS simulator .app bundle. Build with xcodebuild for iphonesimulator first."
  );
}

const iosPlatformVersion = process.env.IOS_PLATFORM_VERSION;
const iosDeviceUdid = process.env.IOS_DEVICE_UDID;

export const config: Options.Testrunner = {
  ...sharedConfig,
  capabilities: [
    {
      platformName: "iOS",
      "appium:automationName": "XCUITest",
      "appium:deviceName": process.env.IOS_DEVICE_NAME ?? "iPhone 16",
      ...(iosPlatformVersion ? {"appium:platformVersion": iosPlatformVersion} : {}),
      ...(iosDeviceUdid ? {"appium:udid": iosDeviceUdid} : {}),
      "appium:app": iosAppPath,
      "appium:autoAcceptAlerts": true,
      "appium:newCommandTimeout": 240,
      ...(isCi
        ? {
            "appium:showXcodeLog": true,
            "appium:wdaLaunchTimeout": 180000,
            "appium:wdaConnectionTimeout": 180000,
            "appium:wdaStartupRetries": 3,
            "appium:wdaStartupRetryInterval": 20000,
            "appium:simulatorStartupTimeout": 180000,
          }
        : {}),
    },
  ],
};
