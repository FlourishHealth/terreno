import React, {useCallback, useEffect, useRef} from "react";

import {AnnouncementScreen} from "./AnnouncementScreen";
import {Box} from "./Box";
import {Button} from "./Button";
import {Spinner} from "./Spinner";
import {Text} from "./Text";
import {useAcknowledgeAnnouncement} from "./useAcknowledgeAnnouncement";
import {useAnnouncements} from "./useAnnouncements";

interface AnnouncementNavigatorProps {
  api: unknown;
  baseUrl?: string;
  children: React.ReactNode;
  onError?: (error: unknown) => void;
}

export const AnnouncementNavigator: React.FC<AnnouncementNavigatorProps> = ({
  api,
  baseUrl,
  children,
  onError,
}) => {
  const {pending, isLoading, error, refetch} = useAnnouncements(
    api as Parameters<typeof useAnnouncements>[0],
    baseUrl
  );
  const {acknowledge, recordImpression, isSubmitting} = useAcknowledgeAnnouncement(
    api as Parameters<typeof useAcknowledgeAnnouncement>[0],
    baseUrl
  );

  const current = pending?.current ?? null;
  const currentAnnouncementId = current?.id;
  const currentAnnouncementVersion = current?.version;
  const requiresAcknowledgement = current?.requiresAcknowledgement ?? false;
  const recordedImpressionKeysRef = useRef<Set<string>>(new Set());

  const isShowingAnnouncement = !isLoading && !error && Boolean(current);

  // Record one impression per announcement version only while the modal is visible.
  useEffect(() => {
    if (
      !isShowingAnnouncement ||
      !currentAnnouncementId ||
      currentAnnouncementVersion === undefined
    ) {
      return;
    }
    const impressionKey = `${currentAnnouncementId}:${currentAnnouncementVersion}`;
    if (recordedImpressionKeysRef.current.has(impressionKey)) {
      return;
    }
    recordedImpressionKeysRef.current.add(impressionKey);

    const recordCurrentImpression = async (): Promise<void> => {
      try {
        await recordImpression(currentAnnouncementId);
      } catch (impressionError) {
        console.warn("[AnnouncementNavigator] Failed to record impression", {impressionError});
      }
    };

    void recordCurrentImpression();
  }, [currentAnnouncementId, currentAnnouncementVersion, isShowingAnnouncement, recordImpression]);

  const handleAcknowledge = useCallback(async (): Promise<void> => {
    if (!currentAnnouncementId) {
      return;
    }
    try {
      if (requiresAcknowledgement) {
        await acknowledge(currentAnnouncementId);
      } else {
        await recordImpression(currentAnnouncementId);
      }
      await refetch();
    } catch (ackError) {
      onError?.(ackError);
    }
  }, [
    acknowledge,
    currentAnnouncementId,
    onError,
    recordImpression,
    refetch,
    requiresAcknowledgement,
  ]);

  const handleDismiss = useCallback(async (): Promise<void> => {
    await handleAcknowledge();
  }, [handleAcknowledge]);

  if (isLoading) {
    return (
      <Box
        alignItems="center"
        flex="grow"
        justifyContent="center"
        testID="announcement-navigator-loading"
      >
        <Spinner />
      </Box>
    );
  }

  if (error) {
    const errorObj = error as {status?: number; originalStatus?: number};
    const status = errorObj?.status ?? errorObj?.originalStatus;
    if (status === 401 || status === 403) {
      return <>{children}</>;
    }
    onError?.(error);
    return (
      <Box
        alignItems="center"
        direction="column"
        flex="grow"
        gap={3}
        justifyContent="center"
        padding={6}
        testID="announcement-navigator-error"
      >
        <Text align="center" color="error" size="lg">
          Failed to load announcements
        </Text>
        <Button onClick={refetch} text="Retry" />
      </Box>
    );
  }

  if (!current) {
    return <>{children}</>;
  }

  return (
    <>
      <AnnouncementScreen
        announcement={current}
        isSubmitting={isSubmitting}
        onAcknowledge={handleAcknowledge}
        onDismiss={handleDismiss}
        requiresAcknowledgement={requiresAcknowledgement}
      />
      {children}
    </>
  );
};
