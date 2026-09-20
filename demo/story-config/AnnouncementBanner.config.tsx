import {DemoConfiguration} from "@config";
import {AnnouncementBanner} from "@terreno/ui";
import React from "react";

import {AnnouncementBannerDemo} from "../stories/AnnouncementBanner.stories";

const renderAnnouncementBannerDemo = (): React.ReactElement => <AnnouncementBannerDemo />;

export const AnnouncementBannerConfiguration: DemoConfiguration = {
  name: "AnnouncementBanner",
  component: AnnouncementBanner,
  related: ["Banner", "AnnouncementNavigator", "AnnouncementScreen"],
  description:
    "Non-blocking product announcement surface composed from Banner. Shows a title with dismiss or acknowledgement actions and an optional primary action link.",
  shortDescription: "Banner-style in-app product announcement surface.",
  a11yNotes: [
    "Dismiss controls expose an accessible label. Primary actions use the Banner button semantics.",
  ],
  category: "Pattern",
  status: {
    documentation: "ready",
    figma: "planned",
    ios: "ready",
    android: "ready",
    web: "ready",
  },
  additionalDocumentation: [],
  interfaceName: "AnnouncementBannerProps",
  usage: {
    do: [
      "Use for dismiss-only or acknowledgement-required announcements that should not block the app.",
      "Wrap app content with AnnouncementNavigator so banner announcements overlay children.",
    ],
    doNot: [
      "Do not use for feed-only changelog entries; those belong on a dedicated What's New screen.",
      "Do not hand-roll impression tracking; AnnouncementNavigator records impressions when the banner is visible.",
    ],
  },
  props: {},
  demo: renderAnnouncementBannerDemo,
  demoOptions: {size: "lg"},
  stories: {
    Default: {
      render: renderAnnouncementBannerDemo,
    },
  },
};
