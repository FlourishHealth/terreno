import type {ExpoConfig, ConfigContext} from "expo/config";

import appJson from "./app.json";

const baseConfig = appJson.expo as ExpoConfig;

export default ({config}: ConfigContext): ExpoConfig => {
  const isAppiumCi = process.env.APPIUM_CI === "true";

  if (!isAppiumCi) {
    return {
      ...config,
      ...baseConfig,
    };
  }

  return {
    ...config,
    ...baseConfig,
    updates: {
      ...baseConfig.updates,
      enabled: false,
      checkAutomatically: "NEVER",
      fallbackToCacheTimeout: 0,
    },
    autolinking: {
      exclude: ["expo-dev-client"],
    },
  } as ExpoConfig;
};
