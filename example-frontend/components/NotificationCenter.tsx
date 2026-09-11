import {useQuery} from "@terreno/syncdb/react";
import {
  Box,
  Button,
  Modal,
  NotificationBell,
  NotificationInbox,
  type NotificationInboxItem,
} from "@terreno/ui";
import {useRouter} from "expo-router";
import {DateTime} from "luxon";
import type React from "react";
import {useCallback, useMemo, useState} from "react";
import {useSyncDbReady} from "@/hooks/useSyncDbReady";
import {usePostNotificationsDevNotifyMutation} from "@/store/sdk";
import {type Notification, useDeleteNotification, useUpdateNotification} from "@/store/syncDbSdk";
import {syncDb} from "@/store/syncdb";

const sortByCreatedDesc = (left: Notification, right: Notification): number => {
  const leftMillis = left.created ? DateTime.fromISO(left.created).toMillis() : 0;
  const rightMillis = right.created ? DateTime.fromISO(right.created).toMillis() : 0;
  return rightMillis - leftMillis;
};

const toInboxItem = (notification: Notification): NotificationInboxItem => ({
  body: notification.body,
  created: notification.created,
  href: notification.href,
  id: notification._id,
  kind: notification.kind,
  readAt: notification.readAt ?? null,
  title: notification.title,
});

export const NotificationCenter: React.FC = () => {
  const router = useRouter();
  const isSyncDbReady = useSyncDbReady();
  const [inboxVisible, setInboxVisible] = useState<boolean>(false);
  const [updateNotification] = useUpdateNotification();
  const [deleteNotification] = useDeleteNotification();
  const [sendTestNotification, {isLoading: isSendingTest}] =
    usePostNotificationsDevNotifyMutation();

  const notifications = useQuery<Notification>("notifications", {
    filter: (row) => !row.deleted,
    sort: sortByCreatedDesc,
  });

  const inboxItems = useMemo(
    (): NotificationInboxItem[] => notifications.map(toInboxItem),
    [notifications]
  );

  const unreadCount = useMemo(
    (): number => inboxItems.filter((item) => !item.readAt).length,
    [inboxItems]
  );

  const handleOpenBell = useCallback((): void => {
    setInboxVisible(true);
  }, []);

  const handleDismissInbox = useCallback((): void => {
    setInboxVisible(false);
  }, []);

  const handleMarkRead = useCallback(
    (item: NotificationInboxItem): void => {
      if (!isSyncDbReady) {
        return;
      }
      updateNotification({
        data: {readAt: DateTime.now().toISO()},
        id: item.id,
      });
    },
    [isSyncDbReady, updateNotification]
  );

  const handleMarkUnread = useCallback(
    (item: NotificationInboxItem): void => {
      if (!isSyncDbReady) {
        return;
      }
      updateNotification({
        data: {readAt: null},
        id: item.id,
      });
    },
    [isSyncDbReady, updateNotification]
  );

  const handleDismiss = useCallback(
    (item: NotificationInboxItem): void => {
      if (!isSyncDbReady) {
        return;
      }
      deleteNotification({id: item.id});
    },
    [deleteNotification, isSyncDbReady]
  );

  const handleOpen = useCallback(
    (item: NotificationInboxItem): void => {
      setInboxVisible(false);
      if (!item.href) {
        return;
      }
      if (item.href.startsWith("/")) {
        router.push(item.href as `/${string}`);
        return;
      }
    },
    [router]
  );

  const handleSendTest = useCallback(async (): Promise<void> => {
    try {
      await sendTestNotification({
        body: "Sent from the example todos screen.",
        href: "/",
        title: "Terreno test notification",
      }).unwrap();
      // Dev notify writes over HTTP; nudge sync to close the subscribe/reconcile gap so
      // the new row stays visible without waiting for a periodic reconcile or refresh.
      if (isSyncDbReady) {
        void syncDb.reconcile().catch((error: unknown) => {
          console.warn("Notification test reconcile failed", error);
        });
      }
    } catch (error: unknown) {
      console.error("Failed to send test notification", error);
    }
  }, [isSyncDbReady, sendTestNotification]);

  return (
    <>
      <Box alignItems="center" direction="row" gap={2}>
        <NotificationBell onPress={handleOpenBell} unreadCount={unreadCount} />
        {__DEV__ && (
          <Button
            loading={isSendingTest}
            onClick={handleSendTest}
            testID="notification-send-test-button"
            text="Test"
            variant="ghost"
          />
        )}
      </Box>
      <Modal
        onDismiss={handleDismissInbox}
        secondaryButtonOnClick={handleDismissInbox}
        secondaryButtonText="Close"
        testID="notification-inbox-modal"
        title="Notifications"
        visible={inboxVisible}
      >
        <Box maxHeight={420} scroll testID="notification-inbox-scroll">
          <NotificationInbox
            isLoading={!isSyncDbReady}
            items={inboxItems}
            onDismiss={handleDismiss}
            onMarkRead={handleMarkRead}
            onMarkUnread={handleMarkUnread}
            onOpen={handleOpen}
          />
        </Box>
      </Modal>
    </>
  );
};
