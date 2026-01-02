import {getAuthToken, useSelectCurrentUserId} from "@terreno/rtk";
import {sentrySetUser} from "@utils";
import axios from "axios";
import {useEffect} from "react";

import {useReadProfile} from "./useReadProfile";

export const useSentryUserSetup = (): void => {
  const currentUserId = useSelectCurrentUserId();
  const profile = useReadProfile();

  // Update Sentry user context and axios authorization
  useEffect(() => {
    if (!currentUserId || !profile?.type) {
      sentrySetUser(null);
      return;
    }

    const setupSentryUser = async (): Promise<void> => {
      if (currentUserId && profile?.type) {
        const token = await getAuthToken();
        axios.defaults.headers.common.Authorization = `Bearer ${token}`;
        const sentryUser: {id: string; email?: string; username?: string} = {id: profile._id};
        // We don't want to send PII for our patients to Sentry if we can avoid it.
        // But nothing having to look up the _id for staff is nice.
        if (profile?.admin) {
          sentryUser.email = profile.email;
          sentryUser.username = profile.name;
        }
        sentrySetUser({_id: profile._id, type: profile.type});
      }
    };
    setupSentryUser().catch((error) => {
      console.warn("Error setting up Sentry user", error);
    });
  }, [currentUserId, profile]);
};
