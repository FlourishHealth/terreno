import Constants from "expo-constants";
import type {ExpoPushToken} from "expo-notifications";
import * as Updates from "expo-updates";
import {Platform} from "react-native";

interface VersionInfo {
  environment: "production" | "staging" | "publish-on-merge" | "dev" | "unknown" | null;
  dev: boolean;
  updateChannel: string;
  version: string;
}

export function versionInfo(): VersionInfo {
  return {
    dev: Boolean(__DEV__),
    environment: Constants.expoConfig?.extra?.APP_ENV ?? (__DEV__ ? "dev" : "unknown"),
    // According to https://docs.expo.dev/versions/latest/sdk/updates/ the Updates.channel is the suggested way to check
    // for apps. For web, we need to use the manifest.
    updateChannel:
      Updates.channel ??
      (Constants.manifest2?.metadata as {channel?: string})?.channel ??
      "unknown",
    // According to https://docs.expo.dev/versions/latest/sdk/constants/ the expoConfig is the suggested way to check
    // version, and handles expo-updates
    version:
      (Updates.manifest as {version?: string})?.version ??
      Constants.expoConfig?.version ??
      "Unknown",
  };
}

export const getCurrentExpoToken = async (): Promise<ExpoPushToken> => {
  if (Platform.OS === "web") {
    return {data: "", type: "expo"};
  }
  // Lazy-load expo-notifications so importing this module on web does not
  // evaluate expo-notifications' DevicePushTokenAutoRegistration side effect,
  // which logs "Listening to push token changes is not yet fully supported on web".
  const Notifications = await import("expo-notifications");
  let tokenRes: ExpoPushToken;
  if (__DEV__) {
    const appConfig = require("../app.json");
    const projectId = appConfig?.expo?.extra?.eas?.projectId;
    tokenRes = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
  } else {
    tokenRes = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas.projectId,
    });
  }
  return tokenRes;
};
