import type {FC} from "react";
import {Pressable, Text, View} from "react-native";

import type {FilterChipProps} from "./Common";
import {Icon} from "./Icon";
import {useTheme} from "./Theme";
import {resolveTestID} from "./testing/resolveTestId";

export const FilterChip: FC<FilterChipProps> = ({
  label,
  value,
  onDismiss,
  disabled = false,
  dismissAccessibilityLabel,
  testID,
}) => {
  const {theme} = useTheme();
  const canDismiss = Boolean(onDismiss) && !disabled;

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: disabled ? theme.surface.disabled : theme.surface.neutralLight,
        borderColor: theme.border.default,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        flexDirection: "row",
        gap: theme.spacing.xs,
        maxWidth: "100%",
        paddingLeft: theme.spacing.md,
        paddingRight: canDismiss ? theme.spacing.xs : theme.spacing.md,
        paddingVertical: theme.spacing.xs,
      }}
      testID={testID}
    >
      <Text
        numberOfLines={1}
        style={{
          color: disabled ? theme.text.extraLight : theme.text.primary,
          flexShrink: 1,
          fontFamily: "text",
          fontSize: 14,
        }}
      >
        <Text style={{color: theme.text.secondaryLight}}>{`${label}: `}</Text>
        <Text style={{fontWeight: "700"}}>{value}</Text>
      </Text>
      {Boolean(canDismiss) && (
        <Pressable
          accessibilityLabel={dismissAccessibilityLabel ?? `Remove ${label} filter`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onDismiss}
          style={{
            alignItems: "center",
            borderRadius: theme.radius.full,
            height: 20,
            justifyContent: "center",
            width: 20,
          }}
          testID={resolveTestID(testID, "dismiss")}
        >
          <Icon color="secondaryLight" iconName="xmark" size="sm" />
        </Pressable>
      )}
    </View>
  );
};
