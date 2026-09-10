import {Box, MarkdownEditor} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";

export const MarkdownEditorDemo: React.FC = (): React.ReactElement => {
  const [value, setValue] = useState("# Hello\n\nEdit on the left.");
  const onChange = useCallback((next: string): void => {
    setValue(next);
  }, []);
  return (
    <Box>
      <MarkdownEditor onChange={onChange} title="Notes" value={value} />
    </Box>
  );
};

export const MarkdownEditorDisabled: React.FC = (): React.ReactElement => {
  const onChange = useCallback((): void => {}, []);
  return (
    <Box>
      <MarkdownEditor disabled onChange={onChange} title="Read only" value="Cannot edit." />
    </Box>
  );
};
