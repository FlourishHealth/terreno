import {Box, Heading, type HeadingProps, type TextColor} from "@terreno/ui";
import type React from "react";
import {View} from "react-native";

import {StorybookContainer} from "./StorybookContainer";

export const renderHeadingText = (text: string, props: Partial<HeadingProps>) => {
  return (
    <Box paddingY={1} width="100%">
      <Heading {...props}>{text}</Heading>
    </Box>
  );
};

export const Headings = (): React.ReactElement => {
  return (
    <StorybookContainer>
      {renderHeadingText("Default Heading/sm - h4", {})}
      {renderHeadingText("xl - h1", {size: "xl"})}
      {renderHeadingText("large - h2", {size: "lg"})}
      {renderHeadingText("medium - h3", {size: "md"})}
      {[
        "primary",
        "secondaryLight",
        "extraLight",
        "secondaryDark",
        "link",
        "linkLight",
        "accent",
        "error",
        "warning",
        "success",
      ].map((color) => renderHeadingText(color, {color: color as TextColor}))}

      <View style={{backgroundColor: "black", paddingBottom: 8, paddingTop: 8}}>
        {renderHeadingText("inverted", {color: "inverted"})}
      </View>
      {renderHeadingText("center", {align: "center"})}
    </StorybookContainer>
  );
};
