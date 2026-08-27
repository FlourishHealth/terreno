import type React from "react";
import {useCallback, useEffect} from "react";
import {Platform} from "react-native";
import {usePostCommsPushTokensMutation} from "@/store/openApiSdk";
import {registerExpoPushToken} from "@/store/registerExpoPushToken";
import {getCurrentExpoToken} from "@/store/utils";

export const PushTokenRegistrar: React.FC = () => {
  const [postToken] = usePostCommsPushTokensMutation();

  const register = useCallback(async (): Promise<void> => {
    try {
      await registerExpoPushToken({
        getToken: getCurrentExpoToken,
        platform: Platform.OS,
        postToken: async (body) => {
          await postToken(body).unwrap();
        },
      });
    } catch (error: unknown) {
      console.warn("[comms] Failed to register Expo push token", error);
    }
  }, [postToken]);

  // Register the current device token once the session is available. Web has no Expo
  // push token, so registerExpoPushToken no-ops there without hitting the API.
  useEffect(() => {
    void register();
  }, [register]);

  return null;
};
