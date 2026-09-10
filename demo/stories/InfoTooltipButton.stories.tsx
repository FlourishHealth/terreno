import {Box, InfoTooltipButton, Text} from "@terreno/ui";
import type React from "react";

export const InfoTooltipButtonDemo: React.FC = (): React.ReactElement => {
  return (
    <Box direction="row" gap={2}>
      <Text>Field label</Text>
      <InfoTooltipButton text="Explains this field." />
    </Box>
  );
};

export const InfoTooltipButtonLong: React.FC = (): React.ReactElement => {
  return <InfoTooltipButton text="Longer helper copy for a denser form." />;
};
