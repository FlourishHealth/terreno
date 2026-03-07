import {Box, Heading, MarkdownEditorField, Text} from "@terreno/ui";
import React, {useState} from "react";

import {StorybookContainer} from "./StorybookContainer";

const defaultMarkdown = `# Hello World

This is **bold** and *italic* text.

## Lists

- Item one
- Item two
- Item three

## Code

\`inline code\` and a block:

    const x = 42;
`;

export const MarkdownEditorFieldDemo = (props: {preview?: boolean}): React.ReactElement => {
  if (props.preview) {
    return (
      <Box alignItems="center" direction="row" gap={3} justifyContent="center" width="100%">
        <Box
          alignItems="center"
          border="default"
          flex="grow"
          justifyContent="center"
          padding={3}
          rounding="md"
        >
          <Heading size="sm">Aa</Heading>
          <Text color="secondaryDark" size="sm">
            Editor
          </Text>
        </Box>
        <Box
          alignItems="center"
          border="default"
          flex="grow"
          justifyContent="center"
          padding={3}
          rounding="md"
        >
          <Heading size="sm">Md</Heading>
          <Text color="secondaryDark" size="sm">
            Preview
          </Text>
        </Box>
      </Box>
    );
  }

  return <MarkdownEditorFieldFull />;
};

const MarkdownEditorFieldFull = (): React.ReactElement => {
  const [value, setValue] = useState(defaultMarkdown);
  return (
    <StorybookContainer>
      <Box maxWidth={900} width="100%">
        <MarkdownEditorField
          onChange={setValue}
          testID="markdown-editor-demo"
          title="Content"
          value={value}
        />
      </Box>
    </StorybookContainer>
  );
};

export const MarkdownEditorFieldWithHelper = (): React.ReactElement => {
  const [value, setValue] = useState("");
  return (
    <StorybookContainer>
      <Box maxWidth={900} width="100%">
        <MarkdownEditorField
          helperText="Supports markdown formatting: **bold**, *italic*, # headings, - lists"
          onChange={setValue}
          title="Description"
          value={value}
        />
      </Box>
    </StorybookContainer>
  );
};

export const MarkdownEditorFieldWithError = (): React.ReactElement => {
  const [value, setValue] = useState("");
  return (
    <StorybookContainer>
      <Box maxWidth={900} width="100%">
        <MarkdownEditorField
          errorText="This field is required"
          onChange={setValue}
          title="Body"
          value={value}
        />
      </Box>
    </StorybookContainer>
  );
};

export const MarkdownEditorFieldDisabled = (): React.ReactElement => (
  <StorybookContainer>
    <Box maxWidth={900} width="100%">
      <MarkdownEditorField
        disabled
        onChange={() => {}}
        title="Read Only"
        value="This content **cannot** be edited."
      />
    </Box>
  </StorybookContainer>
);
