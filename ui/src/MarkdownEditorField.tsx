import type React from "react";
import {useMemo, useRef} from "react";
import {Platform, Pressable, Text as RNText, ScrollView, TextInput, View} from "react-native";

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
  maxHeight?: number;
}

interface ToolbarButton {
  label: string;
  insert: (value: string) => string;
}

const TOOLBAR_BUTTONS: ToolbarButton[] = [
  {insert: (v) => `${v}**text**`, label: "B"},
  {insert: (v) => `${v}_text_`, label: "I"},
  {insert: (v) => `${v}~~text~~`, label: "~"},
  {insert: (v) => `${v}\`code\``, label: "<>"},
  {insert: (v) => (v ? `${v}\n# text` : "# text"), label: "H1"},
  {insert: (v) => (v ? `${v}\n## text` : "## text"), label: "H2"},
  {insert: (v) => (v ? `${v}\n- item` : "- item"), label: "•"},
  {insert: (v) => (v ? `${v}\n> text` : "> text"), label: ">"},
  {insert: (v) => `${v}[text](url)`, label: "🔗"},
];

export const MarkdownEditorField: React.FC<MarkdownEditorFieldProps> = ({
  title,
  value = "",
  onChange,
  placeholder,
  disabled,
  errorText,
  helperText,
  testID,
  maxHeight = 500,
}) => {
  const {theme} = useTheme();
  const isWeb = Platform.OS === "web";
  const inputRef = useRef<TextInput>(null);

  const monoFont = useMemo(
    () => (isWeb ? "monospace" : Platform.select({android: "monospace", ios: "Menlo"})),
    [isWeb]
  );

  return (
    <View testID={testID}>
      {Boolean(title) && <FieldTitle text={title!} />}
      <Box
        border={errorText ? "error" : "default"}
        direction={isWeb ? "row" : "column"}
        gap={0}
        overflow="hidden"
        rounding="md"
      >
        <View style={{flex: 1, maxHeight, minHeight: 200}}>
          <ScrollView style={{flex: 1}}>
            <TextInput
              editable={!disabled}
              multiline
              onChangeText={onChange}
              placeholder={placeholder ?? "Enter markdown..."}
              placeholderTextColor={theme.text.secondaryDark}
              ref={inputRef}
              style={{
                backgroundColor: theme.surface.base,
                borderBottomWidth: isWeb ? 0 : 1,
                borderColor: theme.border.default,
                borderRightWidth: isWeb ? 1 : 0,
                color: theme.text.primary,
                flex: 1,
                fontFamily: monoFont,
                fontSize: 14,
                minHeight: 200,
                padding: 12,
                textAlignVertical: "top",
              }}
              testID={testID ? `${testID}-input` : undefined}
              value={value}
            />
          </ScrollView>
          {!disabled && (
            <View
              style={{
                backgroundColor: theme.surface.neutralLight,
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
                  onPress={() => onChange(button.insert(value))}
                  style={({pressed}) => ({
                    alignItems: "center",
                    backgroundColor: pressed ? theme.border.default : "transparent",
                    borderColor: theme.border.default,
                    borderRadius: 3,
                    borderWidth: 1,
                    justifyContent: "center",
                    minHeight: 24,
                    minWidth: 28,
                    paddingHorizontal: 5,
                    paddingVertical: 3,
                  })}
                >
                  <RNText
                    style={{
                      color: theme.text.primary,
                      fontFamily: monoFont,
                      fontSize: 12,
                      fontWeight: button.label === "B" ? "700" : "400",
                      lineHeight: 14,
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
        <ScrollView style={{flex: 1, maxHeight, minHeight: 200}}>
          <Box color="base" padding={3} style={{minHeight: 200}}>
            {value ? (
              <MarkdownView>{value}</MarkdownView>
            ) : (
              <Text color="secondaryDark" size="sm">
                Preview
              </Text>
            )}
          </Box>
        </ScrollView>
      </Box>
      {Boolean(errorText) && <FieldError text={errorText!} />}
      {Boolean(helperText) && <FieldHelperText text={helperText!} />}
    </View>
  );
};
