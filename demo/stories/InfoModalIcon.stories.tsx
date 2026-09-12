import {Box, InfoModalIcon, Text} from "@terreno/ui";
import type React from "react";

export const InfoModalIconDemo: React.FC = (): React.ReactElement => {
  return (
    <Box direction="row" gap={2}>
      <Text>Section heading</Text>
      <InfoModalIcon
        infoModalText="Extra context in a modal you can dismiss."
        infoModalTitle="About this section"
      />
    </Box>
  );
};

export const InfoModalIconWithSubtitle: React.FC = (): React.ReactElement => {
  return (
    <InfoModalIcon
      infoModalSubtitle="Optional subtitle"
      infoModalText="Open the icon, then Close."
      infoModalTitle="Help"
    />
  );
};
