import {ActionSheet, Box, Button, DecimalRangeActionSheet, Text} from "@terreno/ui";
import type React from "react";
import {createRef, useCallback, useState} from "react";

export const DecimalRangeActionSheetDemo: React.FC = (): React.ReactElement => {
  const sheetRef = createRef<ActionSheet>();
  const [value, setValue] = useState("5.2");
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
      <Button onClick={openSheet} text="Open decimal range picker" />
      <DecimalRangeActionSheet
        actionSheetRef={sheetRef}
        max={9}
        min={0}
        onChange={onChange}
        value={value}
      />
    </Box>
  );
};

export const DecimalRangeActionSheetClosed: React.FC = (): React.ReactElement => {
  const sheetRef = createRef<ActionSheet>();
  const onChange = useCallback((): void => {}, []);
  return (
    <Box gap={2}>
      <Text>Starts closed.</Text>
      <DecimalRangeActionSheet
        actionSheetRef={sheetRef}
        max={9}
        min={0}
        onChange={onChange}
        value="1.0"
      />
    </Box>
  );
};
