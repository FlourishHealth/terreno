import {Box, Heading, Text} from "@terreno/ui";

export default function SidebarDashboardScreen() {
  return (
    <Box alignItems="center" flex="grow" justifyContent="center" padding={6}>
      <Heading size="lg">Dashboard</Heading>
      <Text color="secondaryDark" size="md">
        Dashboard screen
      </Text>
    </Box>
  );
}
