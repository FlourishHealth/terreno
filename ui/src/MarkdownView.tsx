import React, {useMemo} from "react";
import {Platform} from "react-native";
import Markdown from "react-native-markdown-display";

import {useTheme} from "./Theme";

const IS_WEB = Platform.OS === "web";
const MARKDOWN_SIZES = {
  lg: IS_WEB ? 24 : 20,
  md: IS_WEB ? 18 : 16,
  sm: IS_WEB ? 16 : 14,
  xl: IS_WEB ? 32 : 28,
} as const;
const MONO_FONT = IS_WEB ? "monospace" : Platform.select({android: "monospace", ios: "Menlo"});
const TEXT_FONT_SIZE = IS_WEB ? 16 : 14;
const TEXT_LINE_HEIGHT = IS_WEB ? 24 : 20;

// Takes markdown and renders it with our theme. We should open source this component.
const MarkdownViewComponent: React.FC<{children: React.ReactNode; inverted?: boolean}> = ({
  children,
  inverted,
}) => {
  const {theme} = useTheme();
  const textColor = inverted ? theme.text.inverted : theme.text.primary;
  const markdownStyle = useMemo<React.ComponentProps<typeof Markdown>["style"]>(() => {
    const color = {color: textColor};
    const markdownTextStyle = {
      fontFamily: "text-regular",
      fontSize: TEXT_FONT_SIZE,
      lineHeight: TEXT_LINE_HEIGHT,
      ...color,
    };

    return {
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
        fontFamily: MONO_FONT,
        fontSize: 13,
        padding: 8,
        ...color,
      },
      code_inline: {
        backgroundColor: theme.surface.neutralLight,
        borderColor: theme.border.default,
        borderRadius: 3,
        borderWidth: 1,
        fontFamily: MONO_FONT,
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
        fontFamily: MONO_FONT,
        fontSize: 13,
        padding: 8,
        ...color,
      },
      heading1: {
        fontFamily: "heading-bold",
        fontSize: MARKDOWN_SIZES.xl,
        lineHeight: MARKDOWN_SIZES.xl * 1.25,
        ...color,
      },
      heading2: {
        fontFamily: "heading-bold",
        fontSize: MARKDOWN_SIZES.lg,
        lineHeight: MARKDOWN_SIZES.lg * 1.25,
        ...color,
      },
      heading3: {
        fontFamily: "heading-bold",
        fontSize: MARKDOWN_SIZES.md,
        lineHeight: MARKDOWN_SIZES.md * 1.25,
        ...color,
      },
      heading4: {
        fontFamily: "heading-semibold",
        fontSize: MARKDOWN_SIZES.sm,
        lineHeight: MARKDOWN_SIZES.sm * 1.25,
        ...color,
      },
      // h5/h6 map to small as well for consistency, slightly smaller visually handled by weight
      heading5: {
        fontFamily: "heading-semibold",
        fontSize: MARKDOWN_SIZES.sm,
        lineHeight: MARKDOWN_SIZES.sm * 1.25,
        ...color,
      },
      heading6: {
        fontFamily: "heading-semibold",
        fontSize: MARKDOWN_SIZES.sm,
        lineHeight: MARKDOWN_SIZES.sm * 1.25,
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
    };
  }, [textColor, theme.border.default, theme.surface.neutralLight]);

  return <Markdown style={markdownStyle}>{children}</Markdown>;
};

MarkdownViewComponent.displayName = "MarkdownView";

export const MarkdownView = React.memo(MarkdownViewComponent);
