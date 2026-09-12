import {Box, Heading, OAuthButtons, Text} from "@terreno/ui";
import type React from "react";
import {useCallback} from "react";

export const OAuthButtonsDemo: React.FC = (): React.ReactElement => {
  const onPress = useCallback(async (): Promise<void> => {}, []);
  return (
    <Box maxWidth={360}>
      <OAuthButtons
        providers={[
          {onPress, provider: "google"},
          {onPress, provider: "github"},
          {onPress, provider: "apple"},
        ]}
      />
    </Box>
  );
};

export const OAuthButtonsDisabled: React.FC = (): React.ReactElement => {
  const onPress = useCallback(async (): Promise<void> => {}, []);
  return (
    <Box gap={2} maxWidth={360}>
      <Heading size="sm">Disabled</Heading>
      <OAuthButtons disabled providers={[{onPress, provider: "google"}]} />
      <Text>All provider buttons stay inactive.</Text>
    </Box>
  );
};
