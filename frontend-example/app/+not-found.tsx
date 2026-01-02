import {Link, Stack} from "expo-router";
import {Box, Heading, Text} from "@terreno/ui";
import type React from "react";

const NotFoundScreen: React.FC = () => {
  return (
    <>
      <Stack.Screen options={{title: "Oops!"}} />
      <Box style={{alignItems: "center", flex: 1, justifyContent: "center", padding: 20}}>
        <Heading level={1}>This screen doesn't exist.</Heading>

        <Link href="/" style={{marginTop: 15, paddingVertical: 15}}>
          <Text style={{color: "#2e78b7", fontSize: 14}}>Go to home screen!</Text>
        </Link>
      </Box>
    </>
  );
};

export default NotFoundScreen;
