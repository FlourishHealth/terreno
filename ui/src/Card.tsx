import type React from "react";
import {Image} from "react-native";

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
        {imageUri ? (
          <Image
            accessibilityLabel={imageAlt}
            resizeMode="cover"
            source={{uri: imageUri}}
            style={{height: imageHeight, width: "100%"}}
          />
        ) : (
          <Box color={headerColor} height={80} />
        )}
        <Box direction="column" display="flex" gap={2} padding={padding}>
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
