import {execSync} from "node:child_process";
import type {ConfigContext, ExpoConfig} from "expo/config";

const coerceBuildNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const parsedValue = typeof value === "number" ? value : parseInt(String(value), 10);
  if (!Number.isFinite(parsedValue)) {
    return undefined;
  }

  return parsedValue;
};

const resolveBuildNumber = (configValue: unknown): number | undefined => {
  const fromConfig = coerceBuildNumber(configValue);
  if (fromConfig !== undefined) {
    return fromConfig;
  }

  const fromEnv = coerceBuildNumber(process.env.EXPO_PUBLIC_BUILD_NUMBER);
  if (fromEnv !== undefined) {
    return fromEnv;
  }

  try {
    return parseInt(execSync("git rev-list --count HEAD").toString().trim(), 10);
  } catch {
    return undefined;
  }
};

export default ({config}: ConfigContext): ExpoConfig => {
  const buildNumber = resolveBuildNumber(config.extra?.buildNumber);

  return {
    ...config,
    extra: {
      ...config.extra,
      buildNumber,
    },
  } as ExpoConfig;
};
