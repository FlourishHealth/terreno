import {Box, Heading, Page, Text} from "@terreno/ui";
import type React from "react";

const HomeScreen: React.FC = () => {
  return (
    <Page navigation={undefined} title="Home">
      <Box gap={4} padding={4}>
        <Heading>Welcome to {{appDisplayName}}</Heading>
        <Text>Your app is ready for development!</Text>
        <Text color="secondary">
          Start by adding models to the backend and screens to the frontend.
        </Text>
      </Box>
    </Page>
  );
};

export default HomeScreen;
