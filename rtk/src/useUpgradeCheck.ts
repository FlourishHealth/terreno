import {useToast} from "@terreno/ui";
import axios from "axios";
import Constants from "expo-constants";
import {useCallback, useEffect, useState} from "react";
import {Linking} from "react-native";
import {baseUrl} from "./constants";
import {IsWeb} from "./platform";

interface VersionCheckResponse {
  status: "ok" | "warning" | "required";
  message?: string;
  updateUrl?: string;
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
  const toast = useToast();

  const onUpdate = useCallback(() => {
    if (IsWeb) {
      window.location.reload();
      return;
    }
    if (updateUrl) {
      void Linking.openURL(updateUrl);
    }
  }, [updateUrl]);

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
        const {status, message, updateUrl: responseUpdateUrl} = response.data;

        if (responseUpdateUrl) {
          setUpdateUrl(responseUpdateUrl);
        }

        if (status === "required") {
          setIsRequired(true);
          setRequiredMessage(message);
        } else if (status === "warning" && message) {
          toast.warn(message, {persistent: true});
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
