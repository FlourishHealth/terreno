import {useToast} from "@terreno/ui";
import Constants from "expo-constants";
import {useCallback, useEffect, useState} from "react";
import {Linking} from "react-native";

import {useLazyGetVersionCheckQuery} from "./emptyApi";
import {IsWeb} from "./platform";

interface UseUpgradeCheckResult {
  canUpdate: boolean;
  isRequired: boolean;
  requiredMessage?: string;
  onUpdate: () => void;
}

export const useUpgradeCheck = (): UseUpgradeCheckResult => {
  const [isRequired, setIsRequired] = useState(false);
  const [requiredMessage, setRequiredMessage] = useState<string>();
  const [updateUrl, setUpdateUrl] = useState<string>();
  const [warningMessage, setWarningMessage] = useState<string>();
  const toast = useToast();
  const [triggerVersionCheck, result] = useLazyGetVersionCheckQuery();
  const buildNumber = Constants.expoConfig?.extra?.buildNumber as number | undefined;

  const onUpdate = useCallback(() => {
    if (updateUrl) {
      void Linking.openURL(updateUrl);
      return;
    }
    if (IsWeb) {
      window.location.reload();
    }
  }, [updateUrl]);

  // Show warning toast in a separate effect. ToastProvider initializes its ref
  // in useEffect, so we may need to retry when toast becomes available.
  useEffect(() => {
    if (!warningMessage) return;
    const toastId = toast.warn(warningMessage, {persistent: true});
    if (toastId) {
      setWarningMessage(undefined);
    }
  }, [warningMessage, toast]);

  useEffect(() => {
    if (buildNumber === undefined || buildNumber === null) {
      return;
    }

    const platform = IsWeb ? "web" : "mobile";
    void triggerVersionCheck({platform, version: buildNumber});
  }, [buildNumber, triggerVersionCheck]);

  // Process the version-check response: block on required, warn on warning
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
    } else if (status === "warning" && message) {
      setWarningMessage(message);
    }

    if (responseUpdateUrl) {
      setUpdateUrl(responseUpdateUrl);
    }
  }, [result.data, result.error, result.isError, result.isSuccess]);

  const canUpdate = IsWeb || !!updateUrl;

  return {canUpdate, isRequired, onUpdate, requiredMessage};
};
