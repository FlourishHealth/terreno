import React from "react";
import {Text as NativeText, Platform, type StyleProp, type TextStyle} from "react-native";

import type {HeadingProps} from "./Common";
import {useTheme} from "./Theme";

const fontSizeAndWeightWeb = {
  "2xl": {size: 48, weight: "bold"},
  lg: {size: 24, weight: "bold"},
  md: {size: 18, weight: "bold"},
  sm: {size: 16, weight: "semibold"},
  xl: {size: 32, weight: "bold"},
};

const fontSizeAndWeighMobile = {
  "2xl": {size: 32, weight: "bold"},
  lg: {size: 20, weight: "bold"},
  md: {size: 16, weight: "bold"},
  sm: {size: 14, weight: "semibold"},
  xl: {size: 28, weight: "bold"},
};

const fontSizes = Platform.OS === "web" ? fontSizeAndWeightWeb : fontSizeAndWeighMobile;

const HeadingComponent = ({
  align,
  children,
  color = "primary",
  size,
  testID,
}: HeadingProps): React.ReactElement => {
  const {theme} = useTheme();

  const style: StyleProp<TextStyle> = {};

  if (size === "sm") {
    style.fontFamily = "heading-semibold";
  } else {
    style.fontFamily = "heading-bold";
  }

  style.fontSize = fontSizes[size || "md"].size;
  if (align) {
    style.textAlign = align;
  }
  style.color = theme.text[color];

  const lines = 0;
  return (
    <NativeText numberOfLines={lines} style={style} testID={testID}>
      {children}
    </NativeText>
  );
};

HeadingComponent.displayName = "Heading";

export const Heading = React.memo(HeadingComponent);
