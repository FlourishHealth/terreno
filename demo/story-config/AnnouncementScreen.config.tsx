import {DemoConfiguration} from "@config";
import {AnnouncementScreen} from "@terreno/ui";
import React from "react";

import {AnnouncementScreenDemo} from "../stories/AnnouncementScreen.stories";

const renderAnnouncementScreenDemo = (): React.ReactElement => <AnnouncementScreenDemo />;

export const AnnouncementScreenConfiguration: DemoConfiguration = {
  additionalDocumentation: [],
  a11yNotes: [
    "Required announcements keep the backdrop persistent and expose an explicit acknowledgement.",
  ],
  category: "Pattern",
  component: AnnouncementScreen,
  demo: renderAnnouncementScreenDemo,
  demoOptions: {size: "lg"},
  description:
    "Blocking product announcement surface with Markdown, rich media, acknowledgement, and a secondary action.",
  interfaceName: "AnnouncementScreenProps",
  name: "AnnouncementScreen",
  props: {},
  related: ["AnnouncementBanner", "AnnouncementNavigator", "MarkdownView"],
  shortDescription: "Blocking in-app product announcement surface.",
  status: {
    android: "ready",
    documentation: "ready",
    figma: "planned",
    ios: "ready",
    web: "ready",
  },
  stories: {
    Default: {
      render: renderAnnouncementScreenDemo,
    },
  },
  usage: {
    do: [
      "Use for staff or safety-critical updates that require acknowledgement.",
      "Use Markdown to explain the launch and include supporting media.",
    ],
    doNot: [
      "Do not use a blocking modal for routine patient updates; use AnnouncementBanner or feed.",
    ],
  },
};
