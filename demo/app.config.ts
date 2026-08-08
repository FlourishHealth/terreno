import type {ExpoConfig, ConfigContext} from "expo/config";
import {withAppBuildGradle, type ConfigPlugin} from "expo/config-plugins";

import appJson from "./app.json";

const baseConfig = appJson.expo as ExpoConfig;

// Debug Android builds skip JS bundling by default and expect Metro. Appium CI ships
// a standalone binary with no dev server, so force bundling during assembleDebug.
const withAppiumCiEmbeddedBundle: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.contents.includes("debuggableVariants = []")) {
      return gradleConfig;
    }

    gradleConfig.modResults.contents = gradleConfig.modResults.contents.replace(
      /react\s*\{/,
      "react {\n    // Appium CI ships standalone debug builds without Metro.\n    debuggableVariants = []"
    );
    return gradleConfig;
  });

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
    plugins: [...(baseConfig.plugins ?? []), withAppiumCiEmbeddedBundle],
  } as ExpoConfig;
};
