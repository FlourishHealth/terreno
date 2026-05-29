import {existsSync} from "node:fs";
import type {Options} from "@wdio/types";

import {sharedConfig} from "./wdio.shared.conf";

const iosAppPath = process.env.IOS_APP_PATH;

if (!iosAppPath || !existsSync(iosAppPath)) {
  throw new Error(
    "Set IOS_APP_PATH to a built iOS simulator .app bundle. Build with xcodebuild for iphonesimulator first."
  );
}

export const config: Options.Testrunner = {
  ...sharedConfig,
  capabilities: [
    {
      platformName: "iOS",
      "appium:automationName": "XCUITest",
      "appium:deviceName": process.env.IOS_DEVICE_NAME ?? "iPhone 16",
      "appium:platformVersion": process.env.IOS_PLATFORM_VERSION,
      "appium:app": iosAppPath,
      "appium:autoAcceptAlerts": true,
      "appium:newCommandTimeout": 240,
    },
  ],
};
