import {Box, Heading, Text} from "@terreno/ui";

export default function SidebarSettingsScreen() {
  return (
    <Box alignItems="center" flex="grow" justifyContent="center" padding={6}>
      <Heading size="lg">Settings</Heading>
      <Text color="secondaryDark" size="md">
        Settings screen
      </Text>
    </Box>
  );
}
