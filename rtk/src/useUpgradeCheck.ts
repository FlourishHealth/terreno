import {useToast} from "@terreno/ui";
import axios from "axios";
import Constants from "expo-constants";
import {useCallback, useEffect, useState} from "react";
import {Linking} from "react-native";
import {baseUrl} from "./constants";
import {IsWeb} from "./platform";

interface VersionCheckResponse {
  message?: string;
  requiredVersion?: number;
  status: "ok" | "warning" | "required";
  updateUrl?: string;
  warningVersion?: number;
}

interface UseUpgradeCheckResult {
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
    const buildNumber = Constants.expoConfig?.extra?.buildNumber as number | undefined;
    if (buildNumber === undefined || buildNumber === null) {
      return;
    }

    const platform = IsWeb ? "web" : "mobile";
    const checkVersion = async (): Promise<void> => {
      try {
        const response = await axios.get<VersionCheckResponse>(
          `${baseUrl}/version-check?version=${buildNumber}&platform=${platform}`
        );
        const {message, status, updateUrl: responseUpdateUrl} = response.data;

        if (status === "required") {
          setIsRequired(true);
          setRequiredMessage(message);
        } else if (status === "warning" && message) {
          setWarningMessage(message);
        }

        if (responseUpdateUrl) {
          setUpdateUrl(responseUpdateUrl);
        }
      } catch (error) {
        console.debug("Version check failed, continuing normally", error);
      }
    };
    void checkVersion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {isRequired, onUpdate, requiredMessage};
};
