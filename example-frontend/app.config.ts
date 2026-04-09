import {resolveBuildNumber} from "@terreno/rtk/buildNumber";
import type {ConfigContext, ExpoConfig} from "expo/config";

export default ({config}: ConfigContext): ExpoConfig => {
  const buildNumber = resolveBuildNumber({configValue: config.extra?.buildNumber});

  return {
    ...config,
    extra: {
      ...config.extra,
      buildNumber,
    },
  } as ExpoConfig;
};
