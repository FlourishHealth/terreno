import {
  Box,
  Modal,
  NotificationBell,
  NotificationInbox,
  type NotificationInboxItem,
  NotificationPreferences,
  type NotificationPreferencesState,
} from "@terreno/ui";
import {DateTime} from "luxon";
import type React from "react";
import {useCallback, useMemo, useState} from "react";

import {StorybookContainer} from "./StorybookContainer";

const FIXTURE_ITEMS: NotificationInboxItem[] = [
  {
    body: "Your todo sync lab run finished successfully.",
    created: "2026-09-10T10:00:00.000Z",
    href: "/todos",
    id: "fixture-1",
    kind: "success",
    title: "Sync complete",
  },
  {
    body: "We posted a reminder about notification preferences.",
    created: "2026-09-09T15:30:00.000Z",
    href: "/settings/notifications",
    id: "fixture-2",
    kind: "info",
    readAt: "2026-09-09T16:00:00.000Z",
    title: "Preferences available",
  },
];

const DEFAULT_PREFS: NotificationPreferencesState = {
  inapp: true,
  mail: true,
  push: false,
  sms: true,
};

export const NotificationCenterDemo: React.FC = () => {
  const [inboxOpen, setInboxOpen] = useState<boolean>(true);
  const [items, setItems] = useState<NotificationInboxItem[]>(FIXTURE_ITEMS);
  const [preferences, setPreferences] = useState<NotificationPreferencesState>(DEFAULT_PREFS);

  const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items]);

  const handleMarkRead = useCallback((item: NotificationInboxItem): void => {
    setItems((current) =>
      current.map((row) => (row.id === item.id ? {...row, readAt: DateTime.now().toISO()} : row))
    );
  }, []);

  const handleMarkUnread = useCallback((item: NotificationInboxItem): void => {
    setItems((current) =>
      current.map((row) => (row.id === item.id ? {...row, readAt: null} : row))
    );
  }, []);

  const handleDismiss = useCallback((item: NotificationInboxItem): void => {
    setItems((current) => current.filter((row) => row.id !== item.id));
  }, []);

  const handleOpenInbox = useCallback((): void => {
    setInboxOpen(true);
  }, []);

  const handleCloseInbox = useCallback((): void => {
    setInboxOpen(false);
  }, []);

  const handleOpenNotification = useCallback((): void => {
    setInboxOpen(false);
  }, []);

  const handleChangePreference = useCallback(
    (channel: keyof NotificationPreferencesState, value: boolean): void => {
      setPreferences((current) => ({...current, [channel]: value}));
    },
    []
  );

  return (
    <StorybookContainer>
      <Box gap={6} padding={4}>
        <Box alignItems="center" direction="row" gap={3}>
          <NotificationBell onPress={handleOpenInbox} unreadCount={unreadCount} />
          <NotificationPreferences onChange={handleChangePreference} preferences={preferences} />
        </Box>
        <Modal
          onDismiss={handleCloseInbox}
          secondaryButtonOnClick={handleCloseInbox}
          secondaryButtonText="Close"
          title="Notifications"
          visible={inboxOpen}
        >
          <NotificationInbox
            items={items}
            onDismiss={handleDismiss}
            onMarkRead={handleMarkRead}
            onMarkUnread={handleMarkUnread}
            onOpen={handleOpenNotification}
          />
        </Modal>
      </Box>
    </StorybookContainer>
  );
};
