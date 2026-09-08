import React, {useCallback, useMemo} from "react";

import {AnnouncementScreen} from "./AnnouncementScreen";
import {Box} from "./Box";
import {Button} from "./Button";
import {Spinner} from "./Spinner";
import {Text} from "./Text";
import {useAcknowledgeAnnouncement} from "./useAcknowledgeAnnouncement";
import {useAnnouncements} from "./useAnnouncements";

interface AnnouncementNavigatorProps {
  api: unknown;
  acknowledgementMode?: "admin" | "always" | "never";
  baseUrl?: string;
  children: React.ReactNode;
  onError?: (error: unknown) => void;
}

const resolveRequiresAcknowledgement = ({
  acknowledgementMode = "admin",
  requiresAcknowledgement,
}: {
  acknowledgementMode?: "admin" | "always" | "never";
  requiresAcknowledgement: boolean;
}): boolean => {
  if (acknowledgementMode === "always") {
    return true;
  }
  if (acknowledgementMode === "never") {
    return false;
  }
  return requiresAcknowledgement;
};

export const AnnouncementNavigator: React.FC<AnnouncementNavigatorProps> = ({
  api,
  acknowledgementMode = "admin",
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
  const requiresAcknowledgement = useMemo(
    () =>
      current
        ? resolveRequiresAcknowledgement({
            acknowledgementMode,
            requiresAcknowledgement: current.requiresAcknowledgement,
          })
        : false,
    [acknowledgementMode, current]
  );

  const handleImpression = useCallback(async (): Promise<void> => {
    if (!current) {
      return;
    }
    try {
      await recordImpression(current.id);
    } catch (impressionError) {
      console.warn("[AnnouncementNavigator] Failed to record impression", {impressionError});
    }
  }, [current, recordImpression]);

  const handleAcknowledge = useCallback(async (): Promise<void> => {
    if (!current) {
      return;
    }
    try {
      if (requiresAcknowledgement) {
        await acknowledge(current.id);
      } else {
        await recordImpression(current.id);
      }
      await refetch();
    } catch (ackError) {
      onError?.(ackError);
    }
  }, [acknowledge, current, onError, recordImpression, refetch, requiresAcknowledgement]);

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
        onImpression={handleImpression}
        requiresAcknowledgement={requiresAcknowledgement}
      />
      {children}
    </>
  );
};
