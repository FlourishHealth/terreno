import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_700Bold,
  useFonts as useTextFonts,
} from "@expo-google-fonts/nunito";
import {
  TitilliumWeb_600SemiBold,
  TitilliumWeb_700Bold,
  useFonts as useHeadingFonts,
} from "@expo-google-fonts/titillium-web";
import type React from "react";
import {Platform} from "react-native";
import Markdown from "react-native-markdown-display";

import {useTheme} from "./Theme";

// Takes markdown and renders it with our theme. We should open source this component.
export const MarkdownView: React.FC<{children: React.ReactNode; inverted?: boolean}> = ({
  children,
  inverted,
}) => {
  const {theme} = useTheme();

  const color = {color: inverted ? theme.text.inverted : theme.text.primary};

  // Match Heading font sizes to Heading component
  // Web sizes (see src/Heading.tsx): sm:16, md:18, lg:24, xl:32
  // Mobile sizes: sm:14, md:16, lg:20, xl:28
  const isWeb = Platform.OS === "web";
  const sizes = {
    lg: isWeb ? 24 : 20,
    md: isWeb ? 18 : 16,
    sm: isWeb ? 16 : 14,
    xl: isWeb ? 32 : 28,
  } as const;

  // Load fonts similar to Heading/Text components so fontFamily names resolve
  useHeadingFonts({
    heading: TitilliumWeb_600SemiBold,
    "heading-bold": TitilliumWeb_700Bold,
    "heading-semibold": TitilliumWeb_600SemiBold,
  });
  useTextFonts({
    text: Nunito_400Regular,
    "text-bold": Nunito_700Bold,
    "text-medium": Nunito_500Medium,
    "text-regular": Nunito_400Regular,
  });

  const monoFont = isWeb ? "monospace" : Platform.select({android: "monospace", ios: "Menlo"});
  const textFontSize = isWeb ? 16 : 14;
  const textLineHeight = isWeb ? 24 : 20;
  const markdownTextStyle = {
    fontFamily: "text-regular",
    fontSize: textFontSize,
    lineHeight: textLineHeight,
    ...color,
  };

  return (
    <Markdown
      style={{
        body: {width: "100%", ...markdownTextStyle},
        bullet_list: {width: "100%"},
        bullet_list_content: {flex: 1, flexShrink: 1, minWidth: 0},
        bullet_list_icon: {
          flexShrink: 0,
          marginLeft: 0,
          marginRight: 8,
          minWidth: 16,
          textAlign: "center",
          ...markdownTextStyle,
        },
        code_block: {
          backgroundColor: theme.surface.neutralLight,
          borderColor: theme.border.default,
          borderRadius: 4,
          borderWidth: 1,
          fontFamily: monoFont,
          fontSize: 13,
          padding: 8,
          ...color,
        },
        code_inline: {
          backgroundColor: theme.surface.neutralLight,
          borderColor: theme.border.default,
          borderRadius: 3,
          borderWidth: 1,
          fontFamily: monoFont,
          fontSize: 13,
          paddingHorizontal: 4,
          paddingVertical: 1,
          ...color,
        },
        fence: {
          backgroundColor: theme.surface.neutralLight,
          borderColor: theme.border.default,
          borderRadius: 4,
          borderWidth: 1,
          fontFamily: monoFont,
          fontSize: 13,
          padding: 8,
          ...color,
        },
        heading1: {
          fontFamily: "heading-bold",
          fontSize: sizes.xl,
          lineHeight: sizes.xl * 1.25,
          ...color,
        },
        heading2: {
          fontFamily: "heading-bold",
          fontSize: sizes.lg,
          lineHeight: sizes.lg * 1.25,
          ...color,
        },
        heading3: {
          fontFamily: "heading-bold",
          fontSize: sizes.md,
          lineHeight: sizes.md * 1.25,
          ...color,
        },
        heading4: {
          fontFamily: "heading-semibold",
          fontSize: sizes.sm,
          lineHeight: sizes.sm * 1.25,
          ...color,
        },
        // h5/h6 map to small as well for consistency, slightly smaller visually handled by weight
        heading5: {
          fontFamily: "heading-semibold",
          fontSize: sizes.sm,
          lineHeight: sizes.sm * 1.25,
          ...color,
        },
        heading6: {
          fontFamily: "heading-semibold",
          fontSize: sizes.sm,
          lineHeight: sizes.sm * 1.25,
          ...color,
        },
        list_item: {alignItems: "flex-start", flexDirection: "row", width: "100%"},
        ordered_list: {width: "100%"},
        ordered_list_content: {flex: 1, flexShrink: 1, minWidth: 0},
        ordered_list_icon: {
          flexShrink: 0,
          marginLeft: 0,
          marginRight: 8,
          minWidth: 32,
          textAlign: "right",
          ...markdownTextStyle,
        },
        paragraph: {flexShrink: 1, width: "100%", ...markdownTextStyle},
        text: color,
        textgroup: {flexShrink: 1, minWidth: 0},
      }}
    >
      {children}
    </Markdown>
  );
};
