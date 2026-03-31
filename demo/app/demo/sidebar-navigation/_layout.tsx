import type {SidebarNavigationItem} from "@terreno/ui";
import {SidebarNavigation} from "@terreno/ui";

const topItems: SidebarNavigationItem[] = [
  {iconName: "house", label: "Home", route: "index"},
  {iconName: "chart-line", label: "Dashboard", route: "dashboard"},
  {iconName: "folder", label: "Projects", route: "projects"},
  {iconName: "envelope", label: "Messages", route: "messages"},
];

const bottomItems: SidebarNavigationItem[] = [
  {iconName: "gear", label: "Settings", route: "settings"},
  {iconName: "circle-question", label: "Help", route: "help"},
];

export default function SidebarNavigationLayout() {
  return <SidebarNavigation bottomItems={bottomItems} topItems={topItems} />;
}
