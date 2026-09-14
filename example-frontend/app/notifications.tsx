import {useQuery} from "@terreno/syncdb/react";
import {
  Box,
  Button,
  Heading,
  NotificationInbox,
  type NotificationInboxItem,
  Page,
  Text,
} from "@terreno/ui";
import {type Href, useRouter} from "expo-router";
import {DateTime} from "luxon";
import type React from "react";
import {useCallback, useMemo} from "react";
import {sortNotificationsByCreatedDesc, toInboxItem} from "@/components/NotificationCenter";
import {useSyncDbReady} from "@/hooks/useSyncDbReady";
import {useGetNotificationsArchivedQuery} from "@/store/sdk";
import {type Notification, useDeleteNotification} from "@/store/syncDbSdk";
import {syncDb} from "@/store/syncdb";

const AllNotificationsScreen: React.FC = () => {
  const router = useRouter();
  const isSyncDbReady = useSyncDbReady();
  const [deleteNotification] = useDeleteNotification();
  const notifications = useQuery<Notification>("notifications", {
    filter: (notification) => !notification.deleted,
    sort: sortNotificationsByCreatedDesc,
  });
  const {
    data: archivedResponse,
    isFetching: isArchivedLoading,
    refetch: refetchArchived,
  } = useGetNotificationsArchivedQuery();

  const activeItems = useMemo(
    (): NotificationInboxItem[] => notifications.map(toInboxItem),
    [notifications]
  );
  const archivedItems = useMemo((): NotificationInboxItem[] => {
    const rows = archivedResponse?.data ?? [];
    return [...rows]
      .sort((left, right) =>
        sortNotificationsByCreatedDesc(left as Notification, right as Notification)
      )
      .map((row) =>
        toInboxItem({
          ...row,
          _id: row._id ?? "",
          body: row.body ?? "",
          deleted: true,
          title: row.title ?? "",
        } as Notification)
      );
  }, [archivedResponse]);

  const handleBack = useCallback((): void => {
    router.back();
  }, [router]);

  const handleMarkRead = useCallback(
    (item: NotificationInboxItem): void => {
      if (!isSyncDbReady) {
        return;
      }
      syncDb.mutate({
        collection: "notifications",
        data: {readAt: DateTime.now().toISO()},
        id: item.id,
        operation: "update",
      });
    },
    [isSyncDbReady]
  );

  const handleMarkUnread = useCallback(
    (item: NotificationInboxItem): void => {
      if (!isSyncDbReady) {
        return;
      }
      syncDb.mutate({
        collection: "notifications",
        data: {readAt: null},
        id: item.id,
        operation: "update",
      });
    },
    [isSyncDbReady]
  );

  const handleDismiss = useCallback(
    (item: NotificationInboxItem): void => {
      if (!isSyncDbReady) {
        return;
      }
      deleteNotification({id: item.id});
      void syncDb
        .reconcile()
        .then(async (): Promise<void> => {
          await refetchArchived();
        })
        .catch((error: unknown): void => {
          console.error("Failed to refresh archived notifications", error);
        });
    },
    [deleteNotification, isSyncDbReady, refetchArchived]
  );

  const handleOpen = useCallback(
    (item: NotificationInboxItem): void => {
      if (!item.href?.startsWith("/")) {
        return;
      }
      router.push(item.href as Href);
    },
    [router]
  );

  return (
    <Page navigation={undefined} scroll>
      <Box alignSelf="center" gap={6} maxWidth={800} padding={4} width="100%">
        <Box alignItems="center" direction="row" gap={3}>
          <Button
            iconName="arrow-left"
            onClick={handleBack}
            testID="notifications-back-button"
            text="Back"
            variant="ghost"
          />
          <Heading size="xl">All notifications</Heading>
        </Box>
        <Box gap={3}>
          <Heading size="lg">Active</Heading>
          <NotificationInbox
            isLoading={!isSyncDbReady}
            items={activeItems}
            onDismiss={handleDismiss}
            onMarkRead={handleMarkRead}
            onMarkUnread={handleMarkUnread}
            onOpen={handleOpen}
            testID="all-notifications-active"
          />
        </Box>
        <Box gap={3}>
          <Heading size="lg">Archived</Heading>
          {isArchivedLoading || archivedItems.length > 0 ? (
            <NotificationInbox
              isLoading={isArchivedLoading}
              items={archivedItems}
              onDismiss={handleDismiss}
              onMarkRead={handleMarkRead}
              onMarkUnread={handleMarkUnread}
              onOpen={handleOpen}
              testID="all-notifications-archived"
            />
          ) : (
            <Text color="secondaryLight" testID="all-notifications-archived-empty">
              No archived notifications.
            </Text>
          )}
        </Box>
      </Box>
    </Page>
  );
};

export default AllNotificationsScreen;
