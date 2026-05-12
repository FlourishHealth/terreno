import {Box, Heading, Text} from "@terreno/ui";

export default function SidebarHomeScreen() {
  return (
    <Box alignItems="center" flex="grow" justifyContent="center" padding={6}>
      <Heading size="lg">Home</Heading>
      <Text color="secondaryDark" size="md">
        This is a live SidebarNavigation demo. Hover the rail on web or tap the menu on mobile.
      </Text>
    </Box>
  );
}
