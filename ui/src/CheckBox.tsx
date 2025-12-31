import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import type {FC} from "react";
import {View} from "react-native";

import type {CheckBoxProps} from "./Common";
import {useTheme} from "./Theme";

export const CheckBox: FC<CheckBoxProps> = ({selected, size = "md", bgColor = "default"}) => {
  const {theme} = useTheme();
  const px = {
    lg: {container: 24, icon: 16},
    md: {container: 16, icon: 13},
    sm: {container: 10, icon: 8},
  };

  const backgroundColor = {
    accent: theme.text.accent,
    black: theme.text.primary,
    default: theme.text.link,
  };
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: selected ? backgroundColor[bgColor] : "transparent",
        borderColor: backgroundColor[bgColor],
        borderRadius: 3,
        borderWidth: 1,
        height: px[size].container,
        justifyContent: "center",
        width: px[size].container,
      }}
    >
      {selected ? (
        <FontAwesome6
          color={theme.surface.base}
          name="check"
          selectable={undefined}
          size={px[size].icon}
          solid
        />
      ) : null}
    </View>
  );
};
