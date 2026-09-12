import {ActionSheet, Box, Button, Heading, Text} from "@terreno/ui";
import type React from "react";
import {createRef, useCallback} from "react";

export const ActionSheetDemo: React.FC = (): React.ReactElement => {
  const sheetRef = createRef<ActionSheet>();
  // The ActionSheet ref is stable for the life of this story.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ref identity is stable
  const openSheet = useCallback((): void => {
    const sheet = sheetRef.current;
    if (!sheet) {
      return;
    }
    sheet.show();
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: ref identity is stable
  const closeSheet = useCallback((): void => {
    const sheet = sheetRef.current;
    if (!sheet) {
      return;
    }
    sheet.hide();
  }, []);

  return (
    <Box gap={3}>
      <Button onClick={openSheet} text="Open action sheet" />
      <ActionSheet ref={sheetRef as never}>
        <Box gap={2} padding={4}>
          <Heading size="sm">Sheet title</Heading>
          <Text>Choose an option, then dismiss.</Text>
          <Button onClick={closeSheet} text="Close" variant="outline" />
        </Box>
      </ActionSheet>
    </Box>
  );
};

export const ActionSheetClosed: React.FC = (): React.ReactElement => {
  return (
    <Box gap={2}>
      <Text>Closed until you open it from the default demo.</Text>
      <ActionSheet>
        <Text>Hidden until shown</Text>
      </ActionSheet>
    </Box>
  );
};
