import type React from "react";
import {Image} from "react-native";

import {Box} from "./Box";
import {Button} from "./Button";
import type {CardProps} from "./Common";
import {Heading} from "./Heading";
import {isMobileDevice} from "./MediaQuery";
import {Text} from "./Text";

export const Card = ({
  children,
  color = "base",
  padding = 4,
  variant = "container",
  size = "default",
  title,
  description,
  headerColor = "primary",
  buttonText,
  buttonOnClick,
  imageUri,
  imageAlt,
  imageHeight = 160,
  ...rest
}: CardProps): React.ReactElement => {
  if (variant === "display") {
    const isMobile = isMobileDevice();
    // Desktop: large/default = horizontal row; small = vertical column
    // Mobile: always vertical column
    const isHorizontal = !isMobile && size !== "small";

    return (
      <Box
        alignItems={isHorizontal ? "center" : undefined}
        borderBottom="default"
        borderLeft={isMobile ? undefined : "default"}
        borderRight={isMobile ? undefined : "default"}
        borderTop="default"
        color={color}
        direction={isHorizontal ? "row" : "column"}
        gap={isMobile ? 0 : 6}
        overflow="hidden"
        padding={isMobile ? 0 : 6}
        rounding="md"
        shadow
        {...rest}
      >
        {imageUri ? (
          <Image
            accessibilityLabel={imageAlt}
            resizeMode="cover"
            source={{uri: imageUri}}
            style={
              isHorizontal
                ? {alignSelf: "stretch", width: 160}
                : isMobile && size !== "small"
                  ? {flexGrow: 1, flexShrink: 0, width: "100%"}
                  : {height: imageHeight, width: "100%"}
            }
          />
        ) : (
          <Box
            color={headerColor}
            height={isHorizontal ? undefined : imageHeight}
            style={isHorizontal ? {alignSelf: "stretch", width: 160} : {width: "100%"}}
          />
        )}
        <Box
          direction="column"
          flex={isHorizontal ? "grow" : undefined}
          gap={4}
          padding={isMobile ? 4 : 0}
        >
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
