import {AnnouncementBanner, Box, Text} from "@terreno/ui";
import React from "react";

const sampleAnnouncement = {
  body: "We refreshed the patient home screen.",
  displayMode: "banner" as const,
  id: "demo-banner",
  priority: 1,
  requiresAcknowledgement: false,
  title: "New patient home experience",
  version: 1,
};

export const AnnouncementBannerDemo: React.FC = () => (
  <Box direction="column" gap={4} padding={4} width="100%">
    <Text size="lg">Dismiss-only banner</Text>
    <AnnouncementBanner
      announcement={sampleAnnouncement}
      onAcknowledge={() => undefined}
      onDismiss={() => undefined}
      requiresAcknowledgement={false}
    />
    <Text size="lg">Required acknowledgement</Text>
    <AnnouncementBanner
      announcement={{
        ...sampleAnnouncement,
        id: "demo-banner-required",
        requiresAcknowledgement: true,
        title: "Review updated privacy terms",
      }}
      onAcknowledge={() => undefined}
      onDismiss={() => undefined}
      requiresAcknowledgement
    />
  </Box>
);
