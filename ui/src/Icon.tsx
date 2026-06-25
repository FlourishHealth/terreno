import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import type {FC} from "react";

import {type IconProps, iconSizeToNumber} from "./Common";
import {useCustomIcon} from "./IconRegistry";
import {useTheme} from "./Theme";
import {pickTestId} from "./testing/resolveTestId";

export const Icon: FC<IconProps> = ({
  color = "primary",
  size = "md",
  iconName,
  type = "solid",
  testId,
  testID,
}) => {
  const {theme} = useTheme();
  const resolvedTestId = pickTestId({testID, testId});
  const CustomIcon = useCustomIcon(iconName);
  const iconColor = theme.text[color] ?? color;
  const iconSize = iconSizeToNumber(size);

  // A registered custom icon takes precedence over the FontAwesome glyph set.
  if (CustomIcon) {
    return <CustomIcon color={iconColor} size={iconSize} testID={resolvedTestId} />;
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
      testID={resolvedTestId}
      thin={type === "thin"}
    />
  );
};
