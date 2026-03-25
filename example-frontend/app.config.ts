import {execSync} from "node:child_process";

import type {ConfigContext, ExpoConfig} from "expo/config";

/**
 * Optional: set to a number to test version-check behavior without changing git history.
 * Restart Metro (`bun expo start`) after changing this — `expo-constants` reads config at bundle time.
 */
const BUILD_NUMBER_OVERRIDE: number | undefined = undefined;

const coerceBuildNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const n = typeof value === "number" ? value : parseInt(String(value), 10);
  return Number.isFinite(n) ? n : undefined;
};

export default ({config}: ConfigContext): ExpoConfig => {
  let buildNumber = coerceBuildNumber(BUILD_NUMBER_OVERRIDE);

  if (buildNumber === undefined) {
    buildNumber = coerceBuildNumber(config.extra?.buildNumber);
  }

  if (buildNumber === undefined && process.env.EXPO_PUBLIC_BUILD_NUMBER) {
    buildNumber = coerceBuildNumber(process.env.EXPO_PUBLIC_BUILD_NUMBER);
  }

  if (buildNumber === undefined) {
    try {
      buildNumber = parseInt(execSync("git rev-list --count HEAD").toString().trim(), 10);
    } catch {
      buildNumber = 0;
    }
  }

  // `config` is merged static config (e.g. app.json); Expo guarantees required fields at runtime.
  return {
    ...config,
    extra: {
      ...config.extra,
      buildNumber,
    },
  } as ExpoConfig;
};
