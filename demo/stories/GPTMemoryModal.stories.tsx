import {Box, Button, GPTMemoryModal, Text} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";

export const GPTMemoryModalDemo: React.FC = (): React.ReactElement => {
  const [visible, setVisible] = useState(false);
  const [memory, setMemory] = useState("Be concise. Prefer Terreno patterns.");
  const onDismiss = useCallback((): void => {
    setVisible(false);
  }, []);
  const onSave = useCallback((next: string): void => {
    setMemory(next);
    setVisible(false);
  }, []);
  const openModal = useCallback((): void => {
    setVisible(true);
  }, []);
  return (
    <Box gap={3}>
      <Text>{memory}</Text>
      <Button onClick={openModal} text="Open memory modal" />
      <GPTMemoryModal memory={memory} onDismiss={onDismiss} onSave={onSave} visible={visible} />
    </Box>
  );
};

export const GPTMemoryModalEmpty: React.FC = (): React.ReactElement => {
  const [visible, setVisible] = useState(false);
  const onDismiss = useCallback((): void => {
    setVisible(false);
  }, []);
  const onSave = useCallback((): void => {
    setVisible(false);
  }, []);
  const openModal = useCallback((): void => {
    setVisible(true);
  }, []);
  return (
    <Box gap={3}>
      <Button onClick={openModal} text="Open empty memory" />
      <GPTMemoryModal memory="" onDismiss={onDismiss} onSave={onSave} visible={visible} />
    </Box>
  );
};
