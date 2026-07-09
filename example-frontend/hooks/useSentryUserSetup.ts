import {selectBetterAuthUserId} from "@terreno/rtk";
import {sentrySetUser} from "@utils";
import axios from "axios";
import {useEffect} from "react";
import {useSelector} from "react-redux";

import {getSessionToken} from "@/lib/betterAuth";
import {useReadProfile} from "./useReadProfile";

export const useSentryUserSetup = (): void => {
  const currentUserId = useSelector(selectBetterAuthUserId);
  const profile = useReadProfile();

  // Update Sentry user context and axios authorization
  useEffect(() => {
    if (!currentUserId || !profile) {
      sentrySetUser(null);
      return;
    }

    const setupSentryUser = async (): Promise<void> => {
      if (currentUserId && profile) {
        const token = await getSessionToken();
        if (token) {
          axios.defaults.headers.common.Authorization = `Bearer ${token}`;
        }
        const sentryUser: {id: string; email?: string; username?: string} = {id: profile._id};
        if (profile?.admin) {
          sentryUser.email = profile.email;
          sentryUser.username = profile.name;
        }
        sentrySetUser({_id: profile._id});
      }
    };
    setupSentryUser().catch((error) => {
      console.warn("Error setting up Sentry user", error);
    });
  }, [currentUserId, profile]);
};
