import {AnnouncementScreen} from "@terreno/ui";
import React from "react";

const sampleAnnouncement = {
  body: `## Announcements are ready

Launch targeted updates with Markdown, video, screenshots, and tracked actions.

[Watch the launch](https://www.youtube.com/watch?v=dQw4w9WgXcQ)`,
  displayMode: "modal" as const,
  id: "demo-announcement-screen",
  primaryAction: {
    label: "Read the docs",
    url: "https://terreno-docs.netlify.app/docs/reference/announcements",
  },
  priority: 10,
  publishedAt: "2026-09-15T12:00:00.000Z",
  requiresAcknowledgement: true,
  title: "Launch product announcements",
  version: 1,
};

export const AnnouncementScreenDemo: React.FC = () => (
  <AnnouncementScreen
    announcement={sampleAnnouncement}
    onAcknowledge={(): void => {}}
    onDismiss={(): void => {}}
    onPrimaryAction={(): void => {}}
    requiresAcknowledgement
  />
);
