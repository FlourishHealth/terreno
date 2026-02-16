import {Box, Text} from "@terreno/ui";
import type React from "react";

export const UserInactivityDemo = (): React.ReactElement => {
  return (
    <Box padding={4} width="100%">
      <Text>
        No demo available for UserInactivity. This component wraps children and detects user
        inactivity via touch events and keyboard interactions. It is intended to be used at the app
        root level to trigger actions like session timeouts.
      </Text>
    </Box>
  );
};
