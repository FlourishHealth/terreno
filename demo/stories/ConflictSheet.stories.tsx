import {Box, Button, ConflictSheet, Text} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";

const SAMPLE = [
  {
    collection: "todos",
    entityId: "todo-1",
    localData: JSON.stringify({title: "Buy milk", updated: "local"}),
    mutationId: "m1",
    serverData: JSON.stringify({title: "Buy oat milk", updated: "server"}),
  },
];

export const ConflictSheetDemo: React.FC = (): React.ReactElement => {
  const [visible, setVisible] = useState(false);
  const onDismiss = useCallback((): void => {
    setVisible(false);
  }, []);
  const onResolve = useCallback((): void => {
    setVisible(false);
  }, []);
  const openSheet = useCallback((): void => {
    setVisible(true);
  }, []);
  return (
    <Box gap={3}>
      <Button onClick={openSheet} text="Open conflict sheet" />
      <ConflictSheet
        conflicts={SAMPLE}
        onDismiss={onDismiss}
        onResolve={onResolve}
        visible={visible}
      />
    </Box>
  );
};

export const ConflictSheetEmpty: React.FC = (): React.ReactElement => {
  const [visible, setVisible] = useState(false);
  const onDismiss = useCallback((): void => {
    setVisible(false);
  }, []);
  const onResolve = useCallback((): void => {}, []);
  const openSheet = useCallback((): void => {
    setVisible(true);
  }, []);
  return (
    <Box gap={2}>
      <Text>Empty list still dismisses.</Text>
      <Button onClick={openSheet} text="Open empty conflict sheet" />
      <ConflictSheet conflicts={[]} onDismiss={onDismiss} onResolve={onResolve} visible={visible} />
    </Box>
  );
};
