import React, {useCallback, useState} from "react";

import {Box} from "./Box";
import {Modal} from "./Modal";
import {TextArea} from "./TextArea";

export interface GPTMemoryModalProps {
  memory: string;
  onDismiss: () => void;
  onSave: (memory: string) => void;
  visible: boolean;
}

export const GPTMemoryModal = ({
  memory,
  onDismiss,
  onSave,
  visible,
}: GPTMemoryModalProps): React.ReactElement => {
  const [value, setValue] = useState(memory);

  const handleSave = useCallback(() => {
    onSave(value);
    onDismiss();
  }, [onDismiss, onSave, value]);

  return (
    <Modal
      onDismiss={onDismiss}
      primaryButtonOnClick={handleSave}
      primaryButtonText="Save"
      secondaryButtonOnClick={onDismiss}
      secondaryButtonText="Cancel"
      size="md"
      subtitle="Customize the system prompt for your AI assistant."
      title="System Memory"
      visible={visible}
    >
      <Box padding={2}>
        <TextArea
          onChange={setValue}
          placeholder="Enter system instructions..."
          rows={10}
          testID="gpt-memory-textarea"
          value={value}
        />
      </Box>
    </Modal>
  );
};
