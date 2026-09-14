import {type ActionSheet, Box, Button, NumberPickerActionSheet, Text} from "@terreno/ui";
import type React from "react";
import {createRef, useCallback, useState} from "react";

export const NumberPickerActionSheetDemo: React.FC = (): React.ReactElement => {
  const sheetRef = createRef<ActionSheet>();
  const [value, setValue] = useState("3");
  const onChange = useCallback((next: string): void => {
    setValue(next);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: ref identity is stable
  const openSheet = useCallback((): void => {
    const sheet = sheetRef.current;
    if (!sheet) {
      return;
    }
    sheet.show();
  }, []);
  return (
    <Box gap={3}>
      <Text>Selected: {value}</Text>
      <Button onClick={openSheet} text="Open number picker" />
      <NumberPickerActionSheet
        actionSheetRef={sheetRef}
        max={10}
        min={1}
        onChange={onChange}
        value={value}
      />
    </Box>
  );
};

export const NumberPickerActionSheetClosed: React.FC = (): React.ReactElement => {
  const sheetRef = createRef<ActionSheet>();
  const onChange = useCallback((): void => {}, []);
  return (
    <Box gap={2}>
      <Text>Starts closed.</Text>
      <NumberPickerActionSheet
        actionSheetRef={sheetRef}
        max={5}
        min={0}
        onChange={onChange}
        value="0"
      />
    </Box>
  );
};
