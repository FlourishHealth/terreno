import {Body, Box, Text} from "@terreno/ui";
import type React from "react";

export const BodyDemo: React.FC = (): React.ReactElement => {
  return (
    <Box height={200}>
      <Body padding={3} scroll>
        <Text>Scrollable page body content.</Text>
      </Body>
    </Box>
  );
};

export const BodyLoading: React.FC = (): React.ReactElement => {
  return (
    <Box height={200}>
      <Body loading padding={3}>
        <Text>Hidden behind spinner</Text>
      </Body>
    </Box>
  );
};
