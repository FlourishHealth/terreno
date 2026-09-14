import {Box, Heading, ImageBackground, Text} from "@terreno/ui";
import type React from "react";

const SAMPLE_URI = "https://picsum.photos/seed/terreno-bg/800/400";

export const ImageBackgroundDemo: React.FC = (): React.ReactElement => {
  return (
    <ImageBackground source={{uri: SAMPLE_URI}} style={{height: 180, justifyContent: "center"}}>
      <Box padding={4}>
        <Heading size="md">Overlay title</Heading>
      </Box>
    </ImageBackground>
  );
};

export const ImageBackgroundPlain: React.FC = (): React.ReactElement => {
  return (
    <ImageBackground source={{uri: SAMPLE_URI}} style={{height: 120}}>
      <Box padding={3}>
        <Text>Caption on a background image</Text>
      </Box>
    </ImageBackground>
  );
};
