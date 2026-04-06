import {Box, Heading, Text} from "@terreno/ui";

export default function SidebarHelpScreen() {
  return (
    <Box alignItems="center" flex="grow" justifyContent="center" padding={6}>
      <Heading size="lg">Help</Heading>
      <Text color="secondaryDark" size="md">
        Help screen
      </Text>
    </Box>
  );
}
