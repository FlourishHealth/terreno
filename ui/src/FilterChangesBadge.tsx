import type React from "react";
import {View} from "react-native";

import type {FilterChangesBadgeProps} from "./Common";
import {useTheme} from "./Theme";

/**
 * Small blue dot (8x8) rendered next to a filter control's title when its
 * selection differs from the default. Maps to the design system's
 * `variant=status, status=active, color=bold` badge.
 */
export const FilterChangesBadge = ({testID}: FilterChangesBadgeProps): React.ReactElement => {
  const {theme} = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.surface.primary,
        borderRadius: 10,
        height: 8,
        width: 8,
      }}
      testID={testID}
    />
  );
};
