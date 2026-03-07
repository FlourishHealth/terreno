import type React from "react";
import {Platform, TextInput, View} from "react-native";

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
          <TextInput
            editable={!disabled}
            multiline
            onChangeText={onChange}
            placeholder={placeholder ?? "Enter markdown..."}
            placeholderTextColor={theme.text.secondaryDark}
            style={{
              backgroundColor: theme.surface.base,
              borderBottomWidth: isWeb ? 0 : 1,
              borderColor: theme.border.default,
              borderRightWidth: isWeb ? 1 : 0,
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
