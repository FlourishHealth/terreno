import {DateTime} from "luxon";
import type {FC} from "react";
import {Pressable} from "react-native";

import {Box} from "./Box";
import {Heading} from "./Heading";
import {Spinner} from "./Spinner";
import {Text} from "./Text";

export interface NotificationInboxItem {
  body: string;
  created?: string;
  href?: string;
  id: string;
  kind?: string;
  readAt?: string | null;
  title: string;
}

export interface NotificationInboxProps {
  isLoading?: boolean;
  items: NotificationInboxItem[];
  onDismiss: (item: NotificationInboxItem) => void;
  onMarkRead: (item: NotificationInboxItem) => void;
  onMarkUnread: (item: NotificationInboxItem) => void;
  onOpen: (item: NotificationInboxItem) => void;
  testID?: string;
}

const formatTimestamp = (created?: string): string => {
  if (!created) {
    return "";
  }
  const parsed = DateTime.fromISO(created);
  if (!parsed.isValid) {
    return "";
  }
  return parsed.toRelative() ?? parsed.toLocaleString(DateTime.DATETIME_MED);
};

const isUnread = (item: NotificationInboxItem): boolean => !item.readAt;

export const NotificationInbox: FC<NotificationInboxProps> = ({
  isLoading = false,
  items,
  onDismiss,
  onMarkRead,
  onMarkUnread,
  onOpen,
  testID = "notification-inbox",
}) => {
  if (isLoading) {
    return (
      <Box alignItems="center" paddingY={6} testID={`${testID}-loading`}>
        <Spinner />
      </Box>
    );
  }

  if (items.length === 0) {
    return (
      <Box paddingY={4} testID={`${testID}-empty`}>
        <Text color="secondaryLight">You are all caught up.</Text>
      </Box>
    );
  }

  return (
    <Box gap={3} testID={`${testID}-list`}>
      {items.map((item) => {
        const unread = isUnread(item);
        return (
          <Box
            border="default"
            color={unread ? "secondaryLight" : "base"}
            gap={2}
            key={item.id}
            padding={3}
            rounding="md"
            testID={`${testID}-item-${item.id}`}
          >
            <Box alignItems="start" direction="row" justifyContent="between">
              <Box flex="grow" gap={1}>
                <Heading size="sm">{item.title}</Heading>
                {item.created ? (
                  <Text color="secondaryLight" size="sm">
                    {formatTimestamp(item.created)}
                  </Text>
                ) : null}
              </Box>
              <Pressable
                accessibilityLabel="Dismiss notification"
                onPress={() => {
                  onDismiss(item);
                }}
                testID={`${testID}-dismiss-${item.id}`}
              >
                <Text color="secondaryLight">Dismiss</Text>
              </Pressable>
            </Box>
            <Pressable
              onPress={() => {
                onOpen(item);
              }}
              testID={`${testID}-open-${item.id}`}
            >
              <Text>{item.body}</Text>
            </Pressable>
            <Box direction="row" gap={2} wrap>
              {unread ? (
                <Pressable
                  onPress={() => {
                    onMarkRead(item);
                  }}
                  testID={`${testID}-mark-read-${item.id}`}
                >
                  <Text color="link">Mark read</Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => {
                    onMarkUnread(item);
                  }}
                  testID={`${testID}-mark-unread-${item.id}`}
                >
                  <Text color="link">Mark unread</Text>
                </Pressable>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};
