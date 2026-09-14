import {useRouter} from "expo-router";
import {useCallback} from "react";
import {Platform} from "react-native";

const SYNC_LAB_PATH = "/admin/sync-lab";

/**
 * Returns a callback that opens the SyncDB Load Lab admin tool. On web it opens
 * in a separate browser window so the lab can sit next to the debugger (or the
 * main app); on native it falls back to in-app navigation.
 */
export const useOpenSyncLab = (): (() => void) => {
  const router = useRouter();
  return useCallback((): void => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(SYNC_LAB_PATH, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(SYNC_LAB_PATH);
  }, [router]);
};
