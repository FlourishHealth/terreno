import {Box, DismissButton, Text} from "@terreno/ui";
import type React from "react";
import {useCallback, useState} from "react";

export const DismissButtonDemo: React.FC = (): React.ReactElement => {
  const [visible, setVisible] = useState(true);
  const onClick = useCallback((): void => {
    setVisible(false);
  }, []);
  if (!visible) {
    return <Text>Dismissed.</Text>;
  }
  return (
    <Box direction="row" gap={2}>
      <Text>Banner chrome</Text>
      <DismissButton
        accessibilityHint="Hides this row"
        accessibilityLabel="Dismiss"
        onClick={onClick}
      />
    </Box>
  );
};

export const DismissButtonSecondary: React.FC = (): React.ReactElement => {
  const onClick = useCallback((): void => {}, []);
  return (
    <DismissButton
      accessibilityHint="Does nothing in this story"
      accessibilityLabel="Dismiss"
      color="secondaryDark"
      onClick={onClick}
    />
  );
};
