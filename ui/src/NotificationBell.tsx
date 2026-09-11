import type {FC} from "react";
import {Pressable, View} from "react-native";

import {Badge} from "./Badge";
import {Icon} from "./Icon";

export interface NotificationBellProps {
  onPress: () => void;
  testID?: string;
  unreadCount: number;
}

export const NotificationBell: FC<NotificationBellProps> = ({
  onPress,
  testID = "notification-bell",
  unreadCount,
}) => {
  const showBadge = unreadCount > 0;

  return (
    <View style={{position: "relative"}} testID={testID}>
      <Pressable
        accessibilityHint="Opens your notification inbox"
        accessibilityLabel="Notifications"
        accessibilityRole="button"
        onPress={onPress}
        testID={`${testID}-button`}
      >
        <Icon iconName="bell" size="md" testID={`${testID}-icon`} />
      </Pressable>
      {showBadge ? (
        <View
          style={{position: "absolute", right: -4, top: -4}}
          testID={`${testID}-badge-container`}
        >
          <Badge
            maxValue={99}
            status="error"
            testID={`${testID}-badge`}
            value={unreadCount}
            variant="numberOnly"
          />
        </View>
      ) : null}
    </View>
  );
};
