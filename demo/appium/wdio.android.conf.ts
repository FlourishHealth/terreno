import {existsSync} from "node:fs";
import {join} from "node:path";

import {DEMO_APP_PACKAGE} from "./constants";
import {configDir, isCi, sharedConfig} from "./wdio.shared.conf";

const defaultAndroidAppPath = join(
  configDir,
  "../android/app/build/outputs/apk/debug/app-debug.apk"
);
const androidAppPath = process.env.ANDROID_APP_PATH ?? defaultAndroidAppPath;

if (!existsSync(androidAppPath)) {
  throw new Error(
    `Android app not found at ${androidAppPath}. Run expo prebuild and assembleDebug first, or set ANDROID_APP_PATH.`
  );
}

export const config: WebdriverIO.Config = {
  ...sharedConfig,
  capabilities: [
    {
      platformName: "Android",
      "appium:automationName": "UiAutomator2",
      "appium:deviceName": process.env.ANDROID_DEVICE_NAME ?? "Android Emulator",
      "appium:app": androidAppPath,
      "appium:appPackage": DEMO_APP_PACKAGE,
      "appium:appActivity": ".MainActivity",
      "appium:autoGrantPermissions": true,
      "appium:appWaitDuration": 60000,
      "appium:newCommandTimeout": 240,
      "appium:adbExecTimeout": 120000,
      ...(isCi
        ? {
            "appium:skipServerInstallation": false,
            "appium:disableWindowAnimation": true,
          }
        : {}),
    },
  ],
};
