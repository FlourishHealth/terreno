import type React from "react";
import {Image, useWindowDimensions} from "react-native";

import {Box} from "./Box";
import {Button} from "./Button";
import type {CardProps} from "./Common";
import {Heading} from "./Heading";
import {Text} from "./Text";

const DEFAULT_DISPLAY_CARD_WIDTH = 600;
const MOBILE_SMALL_DISPLAY_CARD_WIDTH = 200;
const TITLE_DESCRIPTION_GAP = 1;

const getDisplayCardWidth = ({
  isMobile,
  size,
}: {
  isMobile: boolean;
  size: CardProps["size"];
}): number | undefined => {
  if (isMobile && size === "small") {
    return MOBILE_SMALL_DISPLAY_CARD_WIDTH;
  }

  if (!isMobile && size === "default") {
    return DEFAULT_DISPLAY_CARD_WIDTH;
  }

  return undefined;
};

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

    const cardWidth = getDisplayCardWidth({isMobile, size});
    const cardHeight = isMobile && size === "large" ? 500 : undefined;

    // Image dimensions vary by layout context
    const mobilelargeImageHeight = 300;
    const imageStyle = isRow
      ? {alignSelf: "stretch" as const, width: isMobile ? 100 : 160}
      : {
          height: isMobile && size === "large" ? mobilelargeImageHeight : imageHeight,
          width: "100%" as const,
        };

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
        overflow="hidden"
        padding={padding ?? (isMobile ? 0 : 6)}
        rounding={allBorders ? "md" : undefined}
        {...(cardHeight !== undefined ? {height: cardHeight} : {})}
        {...(cardWidth !== undefined ? {width: cardWidth} : {})}
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
            <Box direction="column" gap={TITLE_DESCRIPTION_GAP}>
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
