import type {DemoConfigurationBase} from "../demoConfig";
import {NotificationCenterDemo} from "../stories/NotificationCenter.stories";

export const NotificationCenterConfiguration: DemoConfigurationBase = {
  category: "Patterns",
  component: () => null,
  demo: () => <NotificationCenterDemo />,
  demoOptions: {},
  description: "Presentational notification bell, inbox list, and channel preferences.",
  interfaceName: "NotificationBellProps",
  name: "Notification Center",
  related: ["NotificationBell", "NotificationInbox", "NotificationPreferences"],
  status: {
    android: "ready",
    documentation: "ready",
    figma: "notSupported",
    ios: "ready",
    web: "ready",
  },
  stories: {},
  usage: {
    do: [
      "Pass fixture or syncdb-backed items into NotificationInbox from the app layer.",
      "Wrap the inbox in Modal or a sheet in the host screen.",
    ],
    doNot: ["Import @terreno/syncdb from @terreno/ui components."],
  },
};
