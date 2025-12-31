import type React from "react";
import {View} from "react-native";
import {useTheme} from "./Theme";

export const SectionDivider: React.FC<{}> = () => {
  const {theme} = useTheme();
  return (
    <View
      accessibilityRole="none"
      aria-hidden={true}
      style={{
        backgroundColor: theme.primitives.neutral500,
        height: 1,
        width: "100%",
      }}
    />
  );
};
