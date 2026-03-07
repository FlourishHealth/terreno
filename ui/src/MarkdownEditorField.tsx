import type {MarkdownRange, MarkdownStyle} from "@expensify/react-native-live-markdown";
import {MarkdownTextInput} from "@expensify/react-native-live-markdown";
import type React from "react";
import {useMemo, useRef} from "react";
import {Platform, Pressable, Text as RNText, View} from "react-native";

import {Box} from "./Box";
import type {ErrorTextProps, HelperTextProps} from "./Common";
import {FieldError, FieldHelperText, FieldTitle} from "./fieldElements";
import {MarkdownView} from "./MarkdownView";
import {Text} from "./Text";
import {useTheme} from "./Theme";

interface MarkdownEditorFieldProps extends HelperTextProps, ErrorTextProps {
  title?: string;
  value?: string;
  onChange: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  testID?: string;
}

interface ToolbarButton {
  label: string;
  prefix: string;
  suffix: string;
  block?: boolean;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  {label: "B", prefix: "**", suffix: "**"},
  {label: "I", prefix: "_", suffix: "_"},
  {label: "~", prefix: "~~", suffix: "~~"},
  {label: "<>", prefix: "`", suffix: "`"},
  {block: true, label: "H1", prefix: "# ", suffix: ""},
  {block: true, label: "H2", prefix: "## ", suffix: ""},
  {block: true, label: "•", prefix: "- ", suffix: ""},
  {block: true, label: ">", prefix: "> ", suffix: ""},
  {label: "🔗", prefix: "[", suffix: "](url)"},
];

/**
 * Lightweight markdown parser for react-native-live-markdown.
 * Handles bold, italic, strikethrough, inline code, headings, links, and blockquotes
 * without requiring expensify-common or browser globals.
 */
const parseMarkdown = (text: string): MarkdownRange[] => {
  "worklet";
  const ranges: MarkdownRange[] = [];

  // Inline patterns: **bold**, _italic_, ~~strikethrough~~, `code`, [text](url)
  const inlinePatterns: Array<{
    pattern: RegExp;
    type: "bold" | "italic" | "strikethrough" | "code" | "link";
  }> = [
    {pattern: /\*\*(.+?)\*\*/g, type: "bold"},
    {pattern: /(?<!\w)_(.+?)_(?!\w)/g, type: "italic"},
    {pattern: /~~(.+?)~~/g, type: "strikethrough"},
    {pattern: /`([^`]+)`/g, type: "code"},
  ];

  for (const {pattern, type} of inlinePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const syntaxLen =
        type === "code" ? 1 : type === "bold" ? 2 : type === "strikethrough" ? 2 : 1;
      ranges.push({length: syntaxLen, start: match.index, type: "syntax"});
      ranges.push({length: match[1]!.length, start: match.index + syntaxLen, type});
      ranges.push({
        length: syntaxLen,
        start: match.index + syntaxLen + match[1]!.length,
        type: "syntax",
      });
    }
  }

  // Links: [text](url)
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  let linkMatch;
  while ((linkMatch = linkPattern.exec(text)) !== null) {
    ranges.push({length: 1, start: linkMatch.index, type: "syntax"}); // [
    ranges.push({length: linkMatch[1]!.length, start: linkMatch.index + 1, type: "bold"}); // text
    ranges.push({length: 2, start: linkMatch.index + 1 + linkMatch[1]!.length, type: "syntax"}); // ](
    ranges.push({
      length: linkMatch[2]!.length,
      start: linkMatch.index + 2 + linkMatch[1]!.length + 1,
      type: "link",
    }); // url
    ranges.push({
      length: 1,
      start: linkMatch.index + 2 + linkMatch[1]!.length + 1 + linkMatch[2]!.length,
      type: "syntax",
    }); // )
  }

  // Line-level patterns: # heading, > blockquote
  const lines = text.split("\n");
  let pos = 0;
  for (const line of lines) {
    const h1Match = line.match(/^(# )(.+)/);
    const h2Match = line.match(/^(## )(.+)/);
    const bqMatch = line.match(/^(> )(.+)/);

    if (h2Match) {
      ranges.push({length: 3, start: pos, type: "syntax"});
      ranges.push({length: h2Match[2]!.length, start: pos + 3, type: "h1"});
    } else if (h1Match) {
      ranges.push({length: 2, start: pos, type: "syntax"});
      ranges.push({length: h1Match[2]!.length, start: pos + 2, type: "h1"});
    } else if (bqMatch) {
      ranges.push({length: 2, start: pos, type: "syntax"});
      ranges.push({length: bqMatch[2]!.length, start: pos + 2, type: "blockquote"});
    }

    pos += line.length + 1; // +1 for \n
  }

  return ranges;
};

export const MarkdownEditorField: React.FC<MarkdownEditorFieldProps> = ({
  title,
  value = "",
  onChange,
  placeholder,
  disabled,
  errorText,
  helperText,
  testID,
}) => {
  const {theme} = useTheme();
  const isWeb = Platform.OS === "web";
  const inputRef = useRef<any>(null);

  const markdownStyle: MarkdownStyle = useMemo(
    () => ({
      blockquote: {
        borderColor: theme.border.default,
        borderWidth: 2,
        marginLeft: 4,
        paddingLeft: 4,
      },
      code: {
        backgroundColor: theme.surface.disabled,
        color: theme.text.error,
        fontFamily: isWeb ? "monospace" : Platform.select({android: "monospace", ios: "Menlo"}),
      },
      h1: {
        fontSize: 20,
      },
      link: {
        color: theme.text.link,
      },
      syntax: {
        color: theme.text.secondaryDark,
      },
    }),
    [isWeb, theme]
  );

  const handleToolbarPress = (button: ToolbarButton) => {
    if (button.block) {
      const newLine = `${button.prefix}text`;
      onChange(value ? `${value}\n${newLine}` : newLine);
    } else {
      onChange(`${value}${button.prefix}text${button.suffix}`);
    }
  };

  return (
    <View testID={testID}>
      {title && <FieldTitle text={title} />}
      <Box
        border={errorText ? "error" : "default"}
        direction={isWeb ? "row" : "column"}
        gap={0}
        overflow="hidden"
        rounding="md"
      >
        <View style={{flex: 1, minHeight: 200}}>
          <MarkdownTextInput
            editable={!disabled}
            markdownStyle={markdownStyle}
            multiline
            onChangeText={onChange}
            parser={parseMarkdown}
            placeholder={placeholder ?? "Enter markdown..."}
            placeholderTextColor={theme.text.secondaryDark}
            ref={inputRef}
            style={{
              backgroundColor: theme.surface.base,
              borderBottomWidth: isWeb ? 0 : 1,
              borderColor: theme.border.default,
              borderRightWidth: isWeb ? 1 : 0,
              borderWidth: 0,
              color: theme.text.primary,
              flex: 1,
              fontFamily: isWeb
                ? "monospace"
                : Platform.select({android: "monospace", ios: "Menlo"}),
              fontSize: 14,
              minHeight: 200,
              padding: 12,
              textAlignVertical: "top",
            }}
            testID={testID ? `${testID}-input` : undefined}
            value={value}
          />
          {!disabled && (
            <View
              style={{
                backgroundColor: theme.surface.disabled,
                borderColor: theme.border.default,
                borderTopWidth: 1,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 2,
                paddingHorizontal: 4,
                paddingVertical: 3,
              }}
            >
              {TOOLBAR_BUTTONS.map((button) => (
                <Pressable
                  key={button.label}
                  onPress={() => handleToolbarPress(button)}
                  style={({pressed}) => ({
                    backgroundColor: pressed ? theme.border.default : "transparent",
                    borderColor: theme.border.default,
                    borderRadius: 3,
                    borderWidth: 1,
                    minWidth: 28,
                    paddingHorizontal: 5,
                    paddingVertical: 2,
                  })}
                >
                  <RNText
                    style={{
                      color: theme.text.primary,
                      fontFamily: isWeb
                        ? "monospace"
                        : Platform.select({android: "monospace", ios: "Menlo"}),
                      fontSize: 11,
                      fontWeight: button.label === "B" ? "700" : "400",
                      textAlign: "center",
                    }}
                  >
                    {button.label}
                  </RNText>
                </Pressable>
              ))}
            </View>
          )}
        </View>
        <View style={{flex: 1, minHeight: 200}}>
          <Box color="base" padding={3} style={{flex: 1, minHeight: 200}}>
            {value ? (
              <MarkdownView>{value}</MarkdownView>
            ) : (
              <Text color="secondaryDark" size="sm">
                Preview
              </Text>
            )}
          </Box>
        </View>
      </Box>
      {errorText && <FieldError text={errorText} />}
      {helperText && <FieldHelperText text={helperText} />}
    </View>
  );
};
