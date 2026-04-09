import type React from "react";
import {Image, useWindowDimensions} from "react-native";

import {Box} from "./Box";
import {Button} from "./Button";
import type {CardProps} from "./Common";
import {Heading} from "./Heading";
import {Text} from "./Text";

export const Card = ({
  children,
  color = "base",
  padding = 4,
  variant = "container",
  size = "default",
  title,
  description,
  buttonText,
  buttonOnClick,
  imageUri,
  imageAlt,
  imageHeight = 160,
  ...rest
}: CardProps): React.ReactElement => {
  const {width: windowWidth} = useWindowDimensions();
  // Desktop (>768px): large/default = horizontal (image left, content right)
  // Mobile (<=768px): always vertical column
  const isMobile = windowWidth <= 768;
  const isHorizontal = !isMobile && size !== "small";

  if (variant === "display") {
    // Card dimensions vary by size on mobile
    const cardWidth = isMobile && size === "small" ? 200 : undefined;
    const cardHeight = isMobile && size === "small" ? 298 : undefined;

    // Image height: large mobile = 500px, all others = imageHeight prop
    const mobileImageHeight = size === "large" ? 500 : imageHeight;

    return (
      <Box
        alignItems={isHorizontal ? "center" : undefined}
        borderBottom="default"
        borderLeft={isMobile ? undefined : "default"}
        borderRight={isMobile ? undefined : "default"}
        borderTop="default"
        color={color}
        direction={isHorizontal ? "row" : "column"}
        gap={isHorizontal ? 6 : 0}
        height={cardHeight}
        overflow="hidden"
        padding={isHorizontal ? 6 : 0}
        rounding="md"
        shadow
        width={cardWidth}
        {...rest}
      >
        {imageUri && (
          <Image
            accessibilityLabel={imageAlt}
            resizeMode="cover"
            source={{uri: imageUri}}
            style={
              isHorizontal
                ? {alignSelf: "stretch", width: 160}
                : {height: mobileImageHeight, width: "100%"}
            }
          />
        )}
        <Box direction="column" flex={isHorizontal ? "grow" : undefined} gap={4} padding={4}>
          {Boolean(title) && <Heading size="md">{title}</Heading>}
          {Boolean(description) && <Text>{description}</Text>}
          {Boolean(buttonText && buttonOnClick) && (
            <Box marginTop={2}>
              <Button onClick={buttonOnClick!} text={buttonText!} />
            </Box>
          )}
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
