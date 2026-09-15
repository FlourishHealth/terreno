import {Box, FilePickerButton, Heading, Text} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";

export const FilePickerButtonDemo: React.FC = (): React.ReactElement => {
  const [names, setNames] = useState<string[]>([]);
  const onFilesSelected = useCallback((files: {name: string}[]): void => {
    setNames(files.map((file) => file.name));
  }, []);

  return (
    <Box gap={3}>
      <Heading size="sm">Attach</Heading>
      <FilePickerButton onFilesSelected={onFilesSelected} />
      <Text>{names.length === 0 ? "No files yet. Open the sheet to pick." : names.join(", ")}</Text>
    </Box>
  );
};

export const FilePickerButtonDisabled: React.FC = (): React.ReactElement => {
  const onFilesSelected = useCallback((): void => {}, []);
  return (
    <Box gap={2}>
      <FilePickerButton disabled onFilesSelected={onFilesSelected} />
      <Text>Disabled — the attach control does not open.</Text>
    </Box>
  );
};
