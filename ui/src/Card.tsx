import {Image} from "react-native";

import {Box} from "./Box";
import type {CardProps} from "./Common";

export const Card = ({
  children,
  color = "base",
  padding = 4,
  imageUri,
  imageAlt,
  imageHeight = 160,
  ...rest
}: CardProps) => {
  if (imageUri) {
    return (
      <Box
        color={color}
        direction="column"
        display="flex"
        overflow="hidden"
        rounding="md"
        shadow
        {...rest}
      >
        <Image
          accessibilityLabel={imageAlt}
          resizeMode="cover"
          source={{uri: imageUri}}
          style={{height: imageHeight, width: "100%"}}
        />
        <Box direction="column" padding={padding}>
          {children}
        </Box>
      </Box>
    );
  }
  return (
    <Box
      color={color}
      direction="column"
      display="flex"
      padding={padding}
      rounding="md"
      shadow
      {...rest}
    >
      {children}
    </Box>
  );
};
