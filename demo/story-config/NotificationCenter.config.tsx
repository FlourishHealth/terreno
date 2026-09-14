import {DemoConfiguration} from "@config";
import type {ReactElement} from "react";

import {NotificationCenterDemo} from "../stories/NotificationCenter.stories";

const renderNotificationCenterDemo = (): ReactElement => <NotificationCenterDemo />;

export const NotificationCenterConfiguration: DemoConfiguration = {
  additionalDocumentation: [],
  a11yNotes: [],
  category: "Pattern",
  component: () => null,
  demo: renderNotificationCenterDemo,
  demoOptions: {},
  description: "Presentational notification bell, inbox list, and channel preferences.",
  interfaceName: "NotificationBellProps",
  name: "Notification Center",
  props: {},
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
