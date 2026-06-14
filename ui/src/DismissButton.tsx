import type React from "react";
import {Pressable} from "react-native";

import {Box} from "./Box";
import type {DismissButtonProps} from "./Common";
import {Icon} from "./Icon";

export const DismissButton = ({
  accessibilityLabel,
  accessibilityHint,
  onClick,
  color = "primary",
}: DismissButtonProps): React.ReactElement | null => {
  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      aria-label={accessibilityLabel}
      aria-role="button"
      onPress={onClick}
      style={{
        alignItems: "center",
        height: 24.5,
        justifyContent: "center",
        width: 24.5,
      }}
    >
      <Box>
        <Icon color={color} iconName="x" type="solid" />
      </Box>
    </Pressable>
  );
};
