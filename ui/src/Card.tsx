import type React from "react";
import {Image, useWindowDimensions} from "react-native";

import {Box} from "./Box";
import {Button} from "./Button";
import type {CardProps} from "./Common";
import {Heading} from "./Heading";
import {Text} from "./Text";

const DEFAULT_DISPLAY_CARD_WIDTH = 600;
const MOBILE_SMALL_DISPLAY_CARD_WIDTH = 200;
const MOBILE_ROW_IMAGE_WIDTH = 100;
const DESKTOP_ROW_IMAGE_WIDTH = 160;
const MOBILE_LARGE_IMAGE_HEIGHT = 300;
const TITLE_DESCRIPTION_GAP = 1;
const MOBILE_BREAKPOINT = 768;

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

type DisplayCardProps = CardProps & {
  isMobile: boolean;
};

const DisplayCard = ({
  children,
  color = "base",
  padding,
  size = "default",
  title,
  description,
  buttonText,
  buttonOnClick,
  imageUri,
  imageAlt,
  imageHeight = 160,
  isMobile,
  variant: _variant,
  ...rest
}: DisplayCardProps): React.ReactElement => {
  const isRow = (!isMobile && size !== "small") || (isMobile && size === "default");
  const cardWidth = getDisplayCardWidth({isMobile, size});

  const columnImageHeight = isMobile && size === "large" ? MOBILE_LARGE_IMAGE_HEIGHT : imageHeight;

  const imageStyle = isRow
    ? {
        alignSelf: "stretch" as const,
        flexShrink: 0,
        width: isMobile ? MOBILE_ROW_IMAGE_WIDTH : DESKTOP_ROW_IMAGE_WIDTH,
      }
    : {
        flexShrink: 0,
        height: columnImageHeight,
        width: "100%" as const,
      };

  return (
    <Box
      alignItems={isRow ? "stretch" : undefined}
      alignSelf={cardWidth === undefined && isMobile ? "stretch" : undefined}
      borderBottom="default"
      borderLeft="default"
      borderRight="default"
      borderTop="default"
      color={color}
      direction={isRow ? "row" : "column"}
      gap={isMobile ? 0 : 6}
      overflow="hidden"
      padding={padding ?? (isMobile ? 0 : 6)}
      rounding="md"
      width={cardWidth ?? (isMobile ? "100%" : undefined)}
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
        flex={isRow ? "shrink" : undefined}
        gap={4}
        minWidth={isRow ? 0 : undefined}
        padding={isMobile ? 4 : 0}
        {...(isRow ? {} : {width: "100%"})}
      >
        {(Boolean(title) || Boolean(description)) && (
          <Box direction="column" gap={TITLE_DESCRIPTION_GAP} minWidth={0} width="100%">
            {Boolean(title) && (
              <Box minWidth={0} width="100%">
                <Heading size="lg">{title}</Heading>
              </Box>
            )}
            {Boolean(description) && (
              <Box minWidth={0} width="100%">
                <Text>{description}</Text>
              </Box>
            )}
          </Box>
        )}
        {Boolean(buttonText && buttonOnClick) && (
          <Button onClick={buttonOnClick!} text={buttonText!} />
        )}
        {children}
      </Box>
    </Box>
  );
};

type ContainerCardProps = CardProps & {
  isMobile: boolean;
};

const ContainerCard = ({
  children,
  color = "base",
  padding,
  isMobile,
  variant: _variant,
  ...rest
}: ContainerCardProps): React.ReactElement => {
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

export const Card = ({variant = "container", ...props}: CardProps): React.ReactElement => {
  if (variant === "display") {
    const DisplayCardWithLayout = (): React.ReactElement => {
      const {width: windowWidth} = useWindowDimensions();
      const isMobile = windowWidth <= MOBILE_BREAKPOINT;

      return <DisplayCard {...props} isMobile={isMobile} />;
    };

    return <DisplayCardWithLayout />;
  }

  const ContainerCardWithLayout = (): React.ReactElement => {
    const {width: windowWidth} = useWindowDimensions();
    const isMobile = windowWidth <= MOBILE_BREAKPOINT;

    return <ContainerCard {...props} isMobile={isMobile} />;
  };

  return <ContainerCardWithLayout />;
};
