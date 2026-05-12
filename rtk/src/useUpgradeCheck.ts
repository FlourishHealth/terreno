import Constants from "expo-constants";
import {useCallback, useEffect, useRef, useState} from "react";
import {AppState, Linking} from "react-native";

import {useLazyGetVersionCheckQuery} from "./emptyApi";
import {IsWeb} from "./platform";

interface UseUpgradeCheckOptions {
  /**
   * How often to re-check for updates (in milliseconds).
   * Defaults to undefined (no polling — single check on mount only).
   */
  pollingIntervalMs?: number;
  /**
   * Re-check when the app or browser tab returns to the foreground.
   * Defaults to false.
   */
  recheckOnForeground?: boolean;
}

interface UseUpgradeCheckResult {
  canUpdate: boolean;
  isRequired: boolean;
  isWarning: boolean;
  requiredMessage?: string;
  warningMessage?: string;
  /** Increments each time a poll returns "warning" status. Useful as a React key to force remount. */
  warningCheckCount: number;
  onUpdate: () => void;
}

/**
 * Checks the running app build number against the backend's VersionConfig
 * thresholds and returns the current upgrade status.
 *
 * - `isRequired` — the build is below the required threshold; the caller
 *   should block the UI (e.g. with `UpgradeRequiredScreen`).
 * - `isWarning` — the build is below the warning threshold; the caller
 *   can render a dismissible `Banner` or similar prompt.
 *
 * By default a single check runs on mount. Pass `pollingIntervalMs` and/or
 * `recheckOnForeground` to keep long-lived sessions up to date.
 *
 * @param options - Optional polling and foreground re-check configuration.
 * @returns Current upgrade status, messages, and an `onUpdate` callback.
 */
export const useUpgradeCheck = (options?: UseUpgradeCheckOptions): UseUpgradeCheckResult => {
  const {pollingIntervalMs, recheckOnForeground = false} = options ?? {};

  const [isRequired, setIsRequired] = useState(false);
  const [isWarning, setIsWarning] = useState(false);
  const [requiredMessage, setRequiredMessage] = useState<string>();
  const [warningMessage, setWarningMessage] = useState<string>();
  const [updateUrl, setUpdateUrl] = useState<string>();
  const [warningCheckCount, setWarningCheckCount] = useState(0);
  const [triggerVersionCheck] = useLazyGetVersionCheckQuery();
  const buildNumber = Constants.expoConfig?.extra?.buildNumber as number | undefined;
  const appState = useRef(AppState.currentState);

  // Process version-check response inline via .unwrap() so every poll trigger
  // is handled, even when RTK Query returns a structurally-shared cached response
  // (which would prevent a useEffect from re-firing).
  const runCheck = useCallback(() => {
    if (buildNumber === undefined || buildNumber === null) {
      return;
    }
    const platform = IsWeb ? "web" : "mobile";
    triggerVersionCheck({platform, version: buildNumber})
      .unwrap()
      .then((data) => {
        const {message, status, updateUrl: responseUpdateUrl} = data;

        if (status === "required") {
          setIsRequired(true);
          setRequiredMessage(message);
          setIsWarning(false);
        } else if (status === "warning") {
          setIsWarning(true);
          setWarningMessage(message);
          setWarningCheckCount((c) => c + 1);
        } else {
          setIsWarning(false);
          setIsRequired(false);
        }

        if (responseUpdateUrl) {
          setUpdateUrl(responseUpdateUrl);
        }
      })
      .catch((error: unknown) => {
        console.debug("Version check failed, continuing normally", error);
      });
  }, [buildNumber, triggerVersionCheck]);

  const onUpdate = useCallback(() => {
    if (IsWeb) {
      window.location.reload();
      return;
    }
    if (updateUrl) {
      void Linking.openURL(updateUrl).catch((err: unknown) => {
        console.warn("Failed to open update URL", err);
      });
    } else {
      console.warn("useUpgradeCheck: no update URL available for mobile update");
    }
  }, [updateUrl]);

  // Initial check on mount
  useEffect(() => {
    runCheck();
  }, [runCheck]);

  // Periodic re-check at the configured interval
  useEffect(() => {
    if (!pollingIntervalMs) {
      return;
    }
    const interval = setInterval(runCheck, pollingIntervalMs);
    return () => clearInterval(interval);
  }, [runCheck, pollingIntervalMs]);

  // Re-check when app/tab returns to foreground
  useEffect(() => {
    if (!recheckOnForeground) {
      return;
    }
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      const wasBackground = /inactive|background/.test(appState.current);
      const isNowActive = nextAppState === "active";

      if (wasBackground && isNowActive) {
        runCheck();
      }

      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [runCheck, recheckOnForeground]);

  const canUpdate = IsWeb || !!updateUrl;

  return {
    canUpdate,
    isRequired,
    isWarning,
    onUpdate,
    requiredMessage,
    warningCheckCount,
    warningMessage,
  };
};
