import {DemoConfiguration} from "@config";
import {
  SidebarNavigationDemo,
  SidebarNavigationManyItems,
  SidebarNavigationMinimal,
} from "@stories";
import {SidebarNavigation} from "@terreno/ui";

export const SidebarNavigationConfiguration: DemoConfiguration = {
  name: "Sidebar navigation",
  component: SidebarNavigation,
  related: ["Side drawer", "Page"],
  description:
    "A custom expo-router navigator providing sidebar navigation. On web it renders a collapsed icon rail that expands on hover. On mobile it renders a hamburger-triggered slide-in drawer. Use in _layout.tsx files to get file-based routing with a sidebar. Also exports SidebarNavigationPanel for standalone use without expo-router.",
  a11yNotes: [
    "Each navigation item is a pressable with an accessibility label matching the item label.",
    "The hamburger menu button on mobile has an accessibility label for screen readers.",
  ],
  category: "Component",
  status: {
    documentation: "inProgress",
    figma: "planned",
    ios: "ready",
    android: "ready",
    web: "ready",
  },
  additionalDocumentation: [],
  interfaceName: "SidebarNavigationProps",
  usage: {
    do: [
      "Use in _layout.tsx as a custom expo-router navigator for sidebar-based navigation.",
      "Place frequently used routes in topItems and secondary actions (settings, logout) in bottomItems.",
      "Use SidebarNavigationPanel for standalone demos or non-expo-router apps.",
    ],
    doNot: [
      "Do not use for temporary or contextual navigation — use Side Drawer instead.",
      "Do not put too many items in either group — consider grouping under sub-routes.",
    ],
  },
  props: {},
  demo: (props: any) => <SidebarNavigationDemo {...props} />,
  demoOptions: {
    size: "lg",
  },
  stories: {
    Default: {render: () => <SidebarNavigationDemo />},
    Minimal: {
      description: "A sidebar with only a few items.",
      render: () => <SidebarNavigationMinimal />,
    },
    ManyItems: {
      description: "A sidebar with many navigation items in both groups.",
      render: () => <SidebarNavigationManyItems />,
    },
  },
};
