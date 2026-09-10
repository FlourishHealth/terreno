import {Box, Button, Heading, SimpleContent, Text} from "@terreno/ui";
import type React from "react";
import {useCallback, useRef} from "react";

export const SimpleContentDemo: React.FC = (): React.ReactElement => {
  const sheetRef = useRef<{open: () => void; close: () => void}>(null);
  const openSheet = useCallback((): void => {
    sheetRef.current?.open();
  }, []);
  const closeSheet = useCallback((): void => {
    sheetRef.current?.close();
  }, []);

  return (
    <Box gap={3}>
      <Button onClick={openSheet} text="Open bottom sheet" />
      <SimpleContent ref={sheetRef}>
        <Box gap={2} padding={4}>
          <Heading size="sm">SimpleContent</Heading>
          <Text>Public ModalSheet export. Open and dismiss from this story.</Text>
          <Button onClick={closeSheet} text="Close" variant="outline" />
        </Box>
      </SimpleContent>
    </Box>
  );
};

export const SimpleContentCopy: React.FC = (): React.ReactElement => {
  return (
    <Box>
      <Text>Use the default demo to open and dismiss the sheet.</Text>
    </Box>
  );
};
