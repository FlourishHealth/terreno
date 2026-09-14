import type {FC, ReactNode} from "react";
import {Pressable, View} from "react-native";

import {Badge} from "./Badge";
import {Icon} from "./Icon";

export interface NotificationBellBadgeRenderProps {
  testID: string;
  unreadCount: number;
}

export interface NotificationBellIconRenderProps {
  testID: string;
}

export interface NotificationBellProps {
  onPress: () => void;
  renderBadge?: (props: NotificationBellBadgeRenderProps) => ReactNode;
  renderIcon?: (props: NotificationBellIconRenderProps) => ReactNode;
  testID?: string;
  unreadCount: number;
}

/**
 * Tap target size. Also reserves room for the badge so it never needs negative
 * offsets, which an ancestor with clipped overflow would slice off.
 */
const BELL_SIZE = 40;

export const NotificationBell: FC<NotificationBellProps> = ({
  onPress,
  renderBadge,
  renderIcon,
  testID = "notification-bell",
  unreadCount,
}) => {
  const showBadge = unreadCount > 0;
  const unreadLabel =
    unreadCount === 1 ? "1 unread notification" : `${unreadCount} unread notifications`;

  return (
    <View style={{height: BELL_SIZE, position: "relative", width: BELL_SIZE}} testID={testID}>
      <Pressable
        accessibilityHint="Opens your notification inbox"
        accessibilityLabel={showBadge ? `Notifications, ${unreadLabel}` : "Notifications"}
        accessibilityRole="button"
        onPress={onPress}
        style={{alignItems: "center", flex: 1, justifyContent: "center"}}
        testID={`${testID}-button`}
      >
        {renderIcon ? (
          renderIcon({testID: `${testID}-icon`})
        ) : (
          <Icon iconName="bell" size="md" testID={`${testID}-icon`} />
        )}
      </Pressable>
      {showBadge ? (
        <View
          pointerEvents="none"
          style={{position: "absolute", right: 0, top: 0}}
          testID={`${testID}-badge-container`}
        >
          {renderBadge ? (
            renderBadge({testID: `${testID}-badge`, unreadCount})
          ) : (
            <Badge
              maxValue={99}
              status="error"
              testID={`${testID}-badge`}
              value={unreadCount}
              variant="numberOnly"
            />
          )}
        </View>
      ) : null}
    </View>
  );
};
