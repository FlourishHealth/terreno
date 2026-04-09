import {useToast} from "@terreno/ui";
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
  const toast = useToast();
  const [triggerVersionCheck, result] = useLazyGetVersionCheckQuery();
  const buildNumber = Constants.expoConfig?.extra?.buildNumber as number | undefined;
  const appState = useRef(AppState.currentState);

  const runCheck = useCallback(() => {
    if (buildNumber === undefined || buildNumber === null) {
      return;
    }
    const platform = IsWeb ? "web" : "mobile";
    void triggerVersionCheck({platform, version: buildNumber});
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

  // Show warning toast in a separate effect. ToastProvider initializes its ref
  // in useEffect, so we may need to retry when toast becomes available.
  useEffect(() => {
    if (!warningMessage) {
      return;
    }
    const toastId = toast.warn(warningMessage, {persistent: true});
    if (toastId) {
      setWarningMessage(undefined);
    } else {
      console.warn("useUpgradeCheck: toast not yet available, will retry on next render");
    }
  }, [warningMessage, toast]);

  // Process version-check response — update warning/required state
  useEffect(() => {
    if (result.isError) {
      console.debug("Version check failed, continuing normally", result.error);
      return;
    }
    if (!result.isSuccess || !result.data) {
      return;
    }

    const {message, status, updateUrl: responseUpdateUrl} = result.data;

    if (status === "required") {
      setIsRequired(true);
      setRequiredMessage(message);
      setIsWarning(false);
    } else if (status === "warning") {
      setIsWarning(true);
      setWarningMessage(message);
    } else {
      setIsWarning(false);
      setIsRequired(false);
    }

    if (responseUpdateUrl) {
      setUpdateUrl(responseUpdateUrl);
    }
  }, [result.data, result.error, result.isError, result.isSuccess]);

  const canUpdate = IsWeb || !!updateUrl;

  return {canUpdate, isRequired, isWarning, onUpdate, requiredMessage, warningMessage};
};
