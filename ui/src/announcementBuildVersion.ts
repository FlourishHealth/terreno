import Constants from "expo-constants";

const coerceBuildNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return undefined;
  }
  return parsed;
};

/**
 * Returns the running app's build number from Expo config, matching
 * `useUpgradeCheck` / `Constants.expoConfig.extra.buildNumber`.
 * Omits the value when missing or not a finite integer.
 */
export const getAnnouncementBuildVersion = (): number | undefined => {
  return coerceBuildNumber(Constants.expoConfig?.extra?.buildNumber);
};
