import {Box, Heading, Link, Text} from "@terreno/ui";
import React from "react";

const NotFoundScreen: React.FC = () => {
  return (
    <Box
      alignItems="center"
      color="base"
      flex="grow"
      gap={3}
      justifyContent="center"
      padding={6}
      testID="admin-spa-not-found"
    >
      <Heading size="lg">Page not found</Heading>
      <Text color="secondaryDark">The page you are looking for does not exist.</Text>
      <Link href="/" text="Go to admin home" />
    </Box>
  );
};

export default NotFoundScreen;
