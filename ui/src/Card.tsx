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
  padding,
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
  const isMobile = windowWidth <= 768;

  if (variant === "display") {
    // Row layout: desktop large/default and mobile default
    const isRow = (!isMobile && size !== "small") || (isMobile && size === "default");
    // All 4 borders on desktop (all sizes) and mobile small; top+bottom only on mobile large/default
    const allBorders = !isMobile || size === "small";

    const cardWidth = isMobile && size === "small" ? 200 : undefined;
    const cardHeight = isMobile && size === "large" ? 500 : undefined;

    // Image dimensions vary by layout context
    const imageStyle = isRow
      ? {alignSelf: "stretch" as const, width: isMobile ? 100 : 160}
      : isMobile && size === "large"
        ? {flex: 1, width: "100%" as const}
        : {height: imageHeight, width: "100%" as const};

    return (
      <Box
        alignItems={isRow ? "center" : undefined}
        borderBottom="default"
        borderLeft={allBorders ? "default" : undefined}
        borderRight={allBorders ? "default" : undefined}
        borderTop="default"
        color={color}
        direction={isRow ? "row" : "column"}
        gap={isMobile ? 0 : 6}
        height={cardHeight}
        overflow="hidden"
        padding={isMobile ? 0 : 6}
        rounding={allBorders ? "md" : undefined}
        width={cardWidth}
        {...rest}
      >
        {imageUri && (
          <Image
            accessibilityLabel={imageAlt}
            resizeMode="cover"
            source={{uri: imageUri}}
            style={imageStyle}
          />
        )}
        <Box
          direction="column"
          flex={isRow ? "grow" : undefined}
          gap={4}
          padding={isMobile ? 4 : 0}
        >
          {(Boolean(title) || Boolean(description)) && (
            <Box direction="column" gap={2}>
              {Boolean(title) && <Heading size="lg">{title}</Heading>}
              {Boolean(description) && <Text>{description}</Text>}
            </Box>
          )}
          {Boolean(buttonText && buttonOnClick) && (
            <Button onClick={buttonOnClick!} text={buttonText!} />
          )}
          {children}
        </Box>
      </Box>
    );
  }

  // Container variant
  return (
    <Box
      borderBottom="default"
      borderLeft={isMobile ? undefined : "default"}
      borderRight={isMobile ? undefined : "default"}
      borderTop="default"
      color={color}
      direction="column"
      display="flex"
      padding={padding ?? (isMobile ? 4 : 6)}
      rounding={isMobile ? undefined : "md"}
      {...rest}
    >
      {children}
    </Box>
  );
};
