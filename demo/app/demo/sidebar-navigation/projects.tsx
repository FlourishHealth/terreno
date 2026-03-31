import {Box, Heading, Text} from "@terreno/ui";

export default function SidebarProjectsScreen() {
  return (
    <Box alignItems="center" flex="grow" justifyContent="center" padding={6}>
      <Heading size="lg">Projects</Heading>
      <Text color="secondaryDark" size="md">
        Projects screen
      </Text>
    </Box>
  );
}
