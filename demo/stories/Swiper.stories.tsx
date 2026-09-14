import {Box, Heading, Swiper, Text} from "@terreno/ui";
import type React from "react";

const PAGES = [
  {subtitle: "One React Native codebase.", title: "Universal apps"},
  {subtitle: "Local-first collections.", title: "Offline sync"},
];

export const SwiperDemo: React.FC = (): React.ReactElement => {
  return (
    <Box>
      <Swiper pages={PAGES} />
    </Box>
  );
};

export const SwiperEmpty: React.FC = (): React.ReactElement => {
  return (
    <Box gap={2}>
      <Heading size="sm">Empty pages</Heading>
      <Swiper pages={[]} />
      <Text>Renders nothing.</Text>
    </Box>
  );
};
