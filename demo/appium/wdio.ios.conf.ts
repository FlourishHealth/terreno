import {existsSync} from "node:fs";

import {isCi, sharedConfig} from "./wdio.shared.conf";

const iosAppPath = process.env.IOS_APP_PATH;

if (!iosAppPath || !existsSync(iosAppPath)) {
  throw new Error(
    "Set IOS_APP_PATH to a built iOS simulator .app bundle. Build with xcodebuild for iphonesimulator first."
  );
}

const iosPlatformVersion = process.env.IOS_PLATFORM_VERSION;
const iosDeviceUdid = process.env.IOS_DEVICE_UDID;

export const config: WebdriverIO.Config = {
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
    },
  ],
};
