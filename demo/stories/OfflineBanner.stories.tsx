import {Box, Heading, OfflineBanner} from "@terreno/ui";
import type React from "react";

export const OfflineBannerDemo: React.FC = (): React.ReactElement => {
  return (
    <Box gap={3}>
      <Heading size="sm">Offline with queue</Heading>
      <OfflineBanner isOnline={false} isSyncing={false} queueLength={3} />
    </Box>
  );
};

export const OfflineBannerSyncing: React.FC = (): React.ReactElement => {
  return <OfflineBanner isOnline={false} isSyncing queueLength={2} />;
};

export const OfflineBannerIdle: React.FC = (): React.ReactElement => {
  return (
    <Box gap={2}>
      <OfflineBanner isOnline isSyncing={false} queueLength={0} />
      <Heading size="sm">Online idle renders nothing</Heading>
    </Box>
  );
};
