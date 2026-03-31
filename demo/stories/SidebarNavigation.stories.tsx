import type {SidebarNavigationItem} from "@terreno/ui";
import {Box, Button, Heading, SidebarNavigationPanel, Text} from "@terreno/ui";
import {router} from "expo-router";
import {type FC, useState} from "react";

const sampleTopItems: SidebarNavigationItem[] = [
  {iconName: "house", label: "Home", route: "index"},
  {iconName: "chart-line", label: "Dashboard", route: "dashboard"},
  {iconName: "folder", label: "Projects", route: "projects"},
  {iconName: "envelope", label: "Messages", route: "messages"},
];

const sampleBottomItems: SidebarNavigationItem[] = [
  {iconName: "gear", label: "Settings", route: "settings"},
  {iconName: "circle-question", label: "Help", route: "help"},
  {iconName: "right-from-bracket", label: "Logout", route: "logout"},
];

export const SidebarNavigationDemo: FC<{
  panelBackgroundColor?: string;
  itemBackgroundColor?: string;
}> = ({panelBackgroundColor, itemBackgroundColor}) => {
  const [activeRoute, setActiveRoute] = useState("index");

  const panelStyle = panelBackgroundColor ? {backgroundColor: panelBackgroundColor} : undefined;
  const itemStyle = itemBackgroundColor ? {backgroundColor: itemBackgroundColor} : undefined;

  return (
    <Box height={400} width="100%">
      <SidebarNavigationPanel
        activeRoute={activeRoute}
        bottomItems={sampleBottomItems}
        itemStyle={itemStyle}
        onNavigate={setActiveRoute}
        panelStyle={panelStyle}
        topItems={sampleTopItems}
      >
        <Box alignItems="center" justifyContent="center" padding={6} style={{flex: 1}}>
          <Heading size="lg">Main Content</Heading>
          <Text color="secondaryDark" size="md">
            Active route: {activeRoute}
          </Text>
        </Box>
      </SidebarNavigationPanel>
    </Box>
  );
};

export const SidebarNavigationMinimal: FC = () => {
  const [activeRoute, setActiveRoute] = useState("index");

  const topItems: SidebarNavigationItem[] = [
    {iconName: "house", label: "Home", route: "index"},
    {iconName: "magnifying-glass", label: "Search", route: "search"},
  ];

  const bottomItems: SidebarNavigationItem[] = [
    {iconName: "user", label: "Profile", route: "profile"},
  ];

  return (
    <Box height={300} width="100%">
      <SidebarNavigationPanel
        activeRoute={activeRoute}
        bottomItems={bottomItems}
        onNavigate={setActiveRoute}
        topItems={topItems}
      >
        <Box alignItems="center" justifyContent="center" padding={6} style={{flex: 1}}>
          <Text size="md">Active: {activeRoute}</Text>
        </Box>
      </SidebarNavigationPanel>
    </Box>
  );
};

export const SidebarNavigationLiveDemo: FC = () => (
  <Box alignItems="center" gap={3} padding={4}>
    <Text color="secondaryDark" size="md">
      SidebarNavigation wraps expo-router's Navigator and must be used as a layout. Open the live
      demo to see it in action with real routing.
    </Text>
    <Button
      iconName="arrow-up-right-from-square"
      onClick={() => router.navigate("/demo/sidebar-navigation")}
      text="Open live demo"
      variant="primary"
    />
  </Box>
);

export const SidebarNavigationManyItems: FC = () => {
  const [activeRoute, setActiveRoute] = useState("analytics");

  const topItems: SidebarNavigationItem[] = [
    {iconName: "chart-pie", label: "Analytics", route: "analytics"},
    {iconName: "users", label: "Users", route: "users"},
    {iconName: "box", label: "Products", route: "products"},
    {iconName: "cart-shopping", label: "Orders", route: "orders"},
    {iconName: "warehouse", label: "Inventory", route: "inventory"},
    {iconName: "file-lines", label: "Reports", route: "reports"},
  ];

  const bottomItems: SidebarNavigationItem[] = [
    {iconName: "shield-halved", label: "Admin", route: "admin"},
    {iconName: "gear", label: "Settings", route: "settings"},
    {iconName: "right-from-bracket", label: "Logout", route: "logout"},
  ];

  return (
    <Box height={500} width="100%">
      <SidebarNavigationPanel
        activeRoute={activeRoute}
        bottomItems={bottomItems}
        onNavigate={setActiveRoute}
        topItems={topItems}
      >
        <Box alignItems="center" justifyContent="center" padding={6} style={{flex: 1}}>
          <Heading size="md">Admin Panel</Heading>
          <Text color="secondaryDark" size="md">
            Viewing: {activeRoute}
          </Text>
        </Box>
      </SidebarNavigationPanel>
    </Box>
  );
};
