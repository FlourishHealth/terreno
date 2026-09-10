import {Box, Heading, Image, Text} from "@terreno/ui";
import type React from "react";

const SAMPLE_URI = "https://picsum.photos/seed/terreno-demo/640/360";

export const ImageDemo: React.FC = (): React.ReactElement => {
  return (
    <Box gap={2}>
      <Heading size="sm">Cover</Heading>
      <Image color="base" fit="cover" naturalWidth={320} src={SAMPLE_URI} />
    </Box>
  );
};

export const ImageContain: React.FC = (): React.ReactElement => {
  return (
    <Box gap={2}>
      <Text>Contain fit</Text>
      <Image color="base" fit="contain" naturalWidth={240} src={SAMPLE_URI} />
    </Box>
  );
};
