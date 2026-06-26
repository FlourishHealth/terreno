import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import type {FC} from "react";

import {type IconProps, iconSizeToNumber} from "./Common";
import {useCustomIcon} from "./IconRegistry";
import {useTheme} from "./Theme";

export const Icon: FC<IconProps> = ({
  color = "primary",
  size = "md",
  iconName,
  type = "solid",
  testID,
}) => {
  const {theme} = useTheme();
  const CustomIcon = useCustomIcon(iconName);
  const iconColor = theme.text[color] ?? color;
  const iconSize = iconSizeToNumber(size);

  // A registered custom icon takes precedence over the FontAwesome glyph set.
  if (CustomIcon) {
    return <CustomIcon color={iconColor} size={iconSize} testID={testID} />;
  }

  return (
    <FontAwesome6
      brand={type === "brand"}
      color={iconColor}
      duotone={type === "duotone"}
      light={type === "light" || type === "sharpLight"}
      name={iconName}
      regular={type === "regular"}
      selectable={undefined}
      sharp={type === "sharp"}
      size={iconSize}
      solid={type === "solid" || type === "sharpSolid"}
      testID={testID}
      thin={type === "thin"}
    />
  );
};
