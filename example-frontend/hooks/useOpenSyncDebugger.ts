import {useRouter} from "expo-router";
import {useCallback} from "react";
import {Platform} from "react-native";

const DEBUGGER_PATH = "/syncdb-debug";

/**
 * Returns a callback that opens the SyncDB debugger. On web it opens in a
 * SEPARATE browser window so the debugger runs side-by-side with the app — this
 * is what the cross-window debug bridge is built for, letting local mutations
 * from the app window stream into the debugger window live. On native (no
 * multi-window) it falls back to in-app navigation.
 */
export const useOpenSyncDebugger = (): (() => void) => {
  const router = useRouter();
  return useCallback((): void => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.open(DEBUGGER_PATH, "_blank", "noopener,noreferrer");
      return;
    }
    router.push(DEBUGGER_PATH);
  }, [router]);
};
