import type React from "react";
import {Image, useWindowDimensions} from "react-native";

import {Badge} from "./Badge";
import {Box} from "./Box";
import {Button} from "./Button";
import type {CardProps} from "./Common";
import {Heading} from "./Heading";
import {Icon} from "./Icon";
import {IconButton} from "./IconButton";
import {Text} from "./Text";

const DEFAULT_DISPLAY_CARD_WIDTH = 600;
const MOBILE_SMALL_DISPLAY_CARD_WIDTH = 200;
const MOBILE_ROW_IMAGE_WIDTH = 100;
const DESKTOP_ROW_IMAGE_WIDTH = 160;
const MOBILE_LARGE_IMAGE_HEIGHT = 300;
const TITLE_DESCRIPTION_GAP = 2;
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
  maxWidth = "100%",
  minWidth = 0,
  overflow = "hidden",
  variant: _variant,
  attention: _attention,
  badge: _badge,
  editAccessibilityLabel: _editAccessibilityLabel,
  helperText: _helperText,
  iconName: _iconName,
  onEdit: _onEdit,
  ...rest
}: DisplayCardProps): React.ReactElement => {
  const isRow = !isMobile && size !== "small";
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
      maxWidth={maxWidth}
      minWidth={minWidth}
      overflow={overflow}
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
        minWidth={0}
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
  maxWidth = "100%",
  minWidth = 0,
  overflow = "hidden",
  variant: _variant,
  size: _size,
  title: _title,
  description: _description,
  buttonText: _buttonText,
  buttonOnClick: _buttonOnClick,
  imageUri: _imageUri,
  imageAlt: _imageAlt,
  imageHeight: _imageHeight,
  attention: _attention,
  badge: _badge,
  editAccessibilityLabel: _editAccessibilityLabel,
  helperText: _helperText,
  iconName: _iconName,
  onEdit: _onEdit,
  ...rest
}: ContainerCardProps): React.ReactElement => {
  const containerBoxProps = {
    borderBottom: "default" as const,
    borderLeft: isMobile ? undefined : ("default" as const),
    borderRight: isMobile ? undefined : ("default" as const),
    borderTop: "default" as const,
    color,
    direction: "column" as const,
    display: "flex" as const,
    maxWidth,
    minWidth,
    overflow,
    padding: padding ?? (isMobile ? 4 : 6),
    rounding: isMobile ? undefined : ("md" as const),
    ...rest,
  };

  return <Box {...containerBoxProps}>{children}</Box>;
};

const EditableCard = ({
  children,
  attention = false,
  badge,
  color,
  description,
  editAccessibilityLabel = "Edit",
  helperText,
  iconName,
  maxWidth = "100%",
  minWidth = 0,
  onEdit,
  overflow = "hidden",
  padding = 3,
  title,
  variant: _variant,
  size: _size,
  buttonText: _buttonText,
  buttonOnClick: _buttonOnClick,
  imageUri: _imageUri,
  imageAlt: _imageAlt,
  imageHeight: _imageHeight,
  ...rest
}: CardProps): React.ReactElement => {
  return (
    <Box
      borderBottom="default"
      borderLeft="default"
      borderRight="default"
      borderTop="default"
      color={color ?? (attention ? "secondaryExtraLight" : "base")}
      direction="row"
      gap={2}
      maxWidth={maxWidth}
      minWidth={minWidth}
      overflow={overflow}
      padding={padding}
      rounding="md"
      width="100%"
      {...rest}
    >
      {Boolean(iconName) && (
        <Box paddingY={1}>
          <Icon iconName={iconName!} size="md" />
        </Box>
      )}
      <Box direction="column" flex="grow" gap={1} minWidth={0}>
        {(Boolean(title) || Boolean(badge)) && (
          <Box alignItems="center" direction="row" gap={2}>
            {Boolean(title) && (
              <Box flex="shrink" minWidth={0}>
                <Text bold size="md" truncate>
                  {title}
                </Text>
              </Box>
            )}
            {Boolean(badge) && <Badge {...badge!} />}
          </Box>
        )}
        {Boolean(description) && <Text size="md">{description}</Text>}
        {Boolean(helperText) && (
          <Text color="secondaryLight" size="sm">
            {helperText}
          </Text>
        )}
        {children}
      </Box>
      {Boolean(onEdit) && (
        <IconButton
          accessibilityLabel={editAccessibilityLabel}
          iconName="pencil"
          onClick={onEdit!}
          variant="ghost"
        />
      )}
    </Box>
  );
};

export const Card = ({variant = "container", ...props}: CardProps): React.ReactElement => {
  const {width: windowWidth} = useWindowDimensions();
  const isMobile = windowWidth <= MOBILE_BREAKPOINT;

  if (variant === "display") {
    return <DisplayCard {...props} isMobile={isMobile} variant={variant} />;
  }

  if (variant === "editable") {
    return <EditableCard {...props} variant={variant} />;
  }

  return <ContainerCard {...props} isMobile={isMobile} variant={variant} />;
};
