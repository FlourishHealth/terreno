import {useFeatureFlags, useSelectCurrentUserId} from "@terreno/rtk";
import {terrenoApi} from "@/store/sdk";

/**
 * Whether the local-first @terreno/syncdb data layer is enabled.
 *
 * Primary source is the backend "use-syncdb" feature flag (same plumbing as the other
 * example flags; see seed-feature-flags.ts). EXPO_PUBLIC_USE_SYNCDB=true acts as a dev
 * override so the sync path can be exercised without touching flag data.
 */
export const useSyncDbEnabled = (): boolean => {
  const userId = useSelectCurrentUserId();
  const {getFlag} = useFeatureFlags(terrenoApi, {skip: !userId, userId});
  if (!userId) {
    return false;
  }
  if (process.env.EXPO_PUBLIC_USE_SYNCDB === "true") {
    return true;
  }
  return getFlag("use-syncdb");
};
