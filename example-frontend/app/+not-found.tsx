import {Box, Heading, Text} from "@terreno/ui";
import {Link, Stack} from "expo-router";
import type React from "react";

const NotFoundScreen: React.FC = () => {
  return (
    <>
      <Stack.Screen options={{title: "Oops!"}} />
      <Box alignItems="center" flex="grow" justifyContent="center" padding={4}>
        <Heading size="xl">This screen doesn't exist.</Heading>

        <Link href="/" style={{marginTop: 15, paddingVertical: 15}}>
          <Text color="link" size="md">
            Go to home screen!
          </Text>
        </Link>
      </Box>
    </>
  );
};

export default NotFoundScreen;
