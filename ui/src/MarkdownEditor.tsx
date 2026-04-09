import React from "react";
import {ScrollView, useWindowDimensions} from "react-native";
import {Box} from "./Box";
import {Heading} from "./Heading";
import {MarkdownView} from "./MarkdownView";
import {TextField} from "./TextField";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  disabled?: boolean;
  testID?: string;
  maxHeight?: number;
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder,
  title,
  disabled,
  testID,
  maxHeight = 500,
}) => {
  const {width} = useWindowDimensions();
  const isDesktop = width >= 768;

  return (
    <Box direction="column" gap={2} testID={testID}>
      {Boolean(title) && <Heading size="sm">{title}</Heading>}
      <Box direction={isDesktop ? "row" : "column"} gap={3}>
        <Box flex="grow">
          <Heading size="sm">Edit</Heading>
          <Box marginTop={1}>
            <TextField
              disabled={disabled}
              grow
              multiline
              onChange={onChange}
              placeholder={placeholder}
              rows={10}
              testID={testID ? `${testID}-input` : undefined}
              value={value}
            />
          </Box>
        </Box>
        <Box flex="grow">
          <Heading size="sm">Preview</Heading>
          <ScrollView style={{maxHeight, minHeight: 100}}>
            <Box
              border="default"
              marginTop={1}
              padding={3}
              rounding="sm"
              testID={testID ? `${testID}-preview` : undefined}
            >
              <MarkdownView>{value || " "}</MarkdownView>
            </Box>
          </ScrollView>
        </Box>
      </Box>
    </Box>
  );
};
