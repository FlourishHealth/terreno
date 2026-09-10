import {Box, Heading, Radio, Text} from "@terreno/ui";
import type React from "react";

export const RadioDemo: React.FC = (): React.ReactElement => {
  return (
    <Box direction="row" gap={3}>
      <Box alignItems="center" direction="row" gap={2}>
        <Radio selected={false} />
        <Text>Unselected</Text>
      </Box>
      <Box alignItems="center" direction="row" gap={2}>
        <Radio selected />
        <Text>Selected</Text>
      </Box>
    </Box>
  );
};

export const RadioSelected: React.FC = (): React.ReactElement => {
  return (
    <Box gap={2}>
      <Heading size="sm">Selected only</Heading>
      <Radio selected />
    </Box>
  );
};
