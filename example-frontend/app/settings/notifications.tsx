import {generateMutationId} from "@terreno/syncdb";
import {useQuery} from "@terreno/syncdb/react";
import {Box, Button, Card, NotificationPreferences, Page, Text} from "@terreno/ui";
import {useRouter} from "expo-router";
import type React from "react";
import {useCallback, useMemo} from "react";
import {useSyncDbReady} from "@/hooks/useSyncDbReady";
import {
  type NotificationPreference,
  useCreateNotificationPreference,
  useUpdateNotificationPreference,
} from "@/store/syncDbSdk";

const DEFAULT_PREFERENCES = {
  inapp: true,
  mail: true,
  push: true,
  sms: true,
};

const NotificationSettingsScreen: React.FC = () => {
  const router = useRouter();
  const isSyncDbReady = useSyncDbReady();
  const [createPreference] = useCreateNotificationPreference();
  const [updatePreference] = useUpdateNotificationPreference();

  const preferenceRows = useQuery<NotificationPreference>("notification-preferences", {
    filter: (row) => !row.deleted,
  });

  const activePreference = preferenceRows[0];

  const preferences = useMemo(
    () => ({
      inapp: activePreference?.inapp ?? DEFAULT_PREFERENCES.inapp,
      mail: activePreference?.mail ?? DEFAULT_PREFERENCES.mail,
      push: activePreference?.push ?? DEFAULT_PREFERENCES.push,
      sms: activePreference?.sms ?? DEFAULT_PREFERENCES.sms,
    }),
    [activePreference]
  );

  const handleChangePreference = useCallback(
    (channel: keyof typeof DEFAULT_PREFERENCES, value: boolean): void => {
      if (!isSyncDbReady) {
        return;
      }
      if (!activePreference) {
        const id = generateMutationId();
        createPreference({
          data: {
            _id: id,
            ...DEFAULT_PREFERENCES,
            [channel]: value,
          },
          id,
        });
        return;
      }
      updatePreference({
        data: {[channel]: value},
        id: activePreference._id,
      });
    },
    [activePreference, createPreference, isSyncDbReady, updatePreference]
  );

  const handleBack = useCallback((): void => {
    router.back();
  }, [router]);

  return (
    <Page navigation={undefined} scroll>
      <Box padding={4}>
        <Box marginBottom={4}>
          <Button
            iconName="arrow-left"
            onClick={handleBack}
            testID="notification-settings-back"
            text="Back"
            variant="ghost"
          />
        </Box>
        <Card>
          {!isSyncDbReady ? (
            <Text color="secondaryLight" testID="notification-settings-loading">
              Loading preferences…
            </Text>
          ) : (
            <NotificationPreferences onChange={handleChangePreference} preferences={preferences} />
          )}
        </Card>
      </Box>
    </Page>
  );
};

export default NotificationSettingsScreen;
