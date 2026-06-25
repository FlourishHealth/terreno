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

const DEFAULT_MAX_HEIGHT = 500;
const MIN_PANE_HEIGHT = 200;

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  placeholder,
  title,
  disabled,
  testID,
  maxHeight = DEFAULT_MAX_HEIGHT,
}) => {
  const {width} = useWindowDimensions();
  const isDesktop = width >= 768;

  const paneContainerStyle = {
    flex: 1,
    height: maxHeight,
    maxHeight,
    minHeight: MIN_PANE_HEIGHT,
  };

  return (
    <Box direction="column" gap={2} testID={testID}>
      {Boolean(title) && <Heading size="sm">{title}</Heading>}
      <Box alignItems="stretch" direction={isDesktop ? "row" : "column"} gap={3}>
        <Box dangerouslySetInlineStyle={{__style: {flexBasis: 0}}} direction="column" flex="grow">
          <Heading size="sm">Edit</Heading>
          <Box
            dangerouslySetInlineStyle={{__style: paneContainerStyle}}
            marginTop={1}
            overflow="hidden"
          >
            <ScrollView style={{flex: 1}}>
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
            </ScrollView>
          </Box>
        </Box>
        <Box dangerouslySetInlineStyle={{__style: {flexBasis: 0}}} direction="column" flex="grow">
          <Heading size="sm">Preview</Heading>
          <Box
            border="default"
            dangerouslySetInlineStyle={{__style: paneContainerStyle}}
            marginTop={1}
            overflow="hidden"
            rounding="sm"
            testID={testID ? `${testID}-preview` : undefined}
          >
            <ScrollView style={{flex: 1}}>
              <Box padding={3}>
                <MarkdownView>{value || " "}</MarkdownView>
              </Box>
            </ScrollView>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
