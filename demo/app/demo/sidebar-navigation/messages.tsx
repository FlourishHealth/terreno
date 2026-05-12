import {Box, Heading, Text} from "@terreno/ui";

export default function SidebarMessagesScreen() {
  return (
    <Box alignItems="center" flex="grow" justifyContent="center" padding={6}>
      <Heading size="lg">Messages</Heading>
      <Text color="secondaryDark" size="md">
        Messages screen
      </Text>
    </Box>
  );
}
