import React, {useCallback} from "react";
import {Linking, Platform, ScrollView} from "react-native";

import {Box} from "./Box";
import {MarkdownView} from "./MarkdownView";
import {Modal} from "./Modal";
import {Text} from "./Text";
import type {AnnouncementPublic} from "./useAnnouncements";

interface AnnouncementScreenProps {
  announcement: AnnouncementPublic;
  isSubmitting?: boolean;
  onAcknowledge: () => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
  requiresAcknowledgement: boolean;
}

export const AnnouncementScreen: React.FC<AnnouncementScreenProps> = ({
  announcement,
  isSubmitting = false,
  onAcknowledge,
  onDismiss,
  requiresAcknowledgement,
}) => {
  const handlePrimaryAction = useCallback(async (): Promise<void> => {
    if (!announcement.primaryAction?.url) {
      return;
    }
    const canOpen = await Linking.canOpenURL(announcement.primaryAction.url);
    if (canOpen) {
      await Linking.openURL(announcement.primaryAction.url);
    }
  }, [announcement.primaryAction?.url]);

  const primaryButtonText = requiresAcknowledgement ? "Got it" : "Dismiss";
  const secondaryButtonText = announcement.primaryAction?.label;

  return (
    <Modal
      onDismiss={onDismiss}
      persistOnBackgroundClick={requiresAcknowledgement}
      primaryButtonDisabled={isSubmitting}
      primaryButtonOnClick={requiresAcknowledgement ? onAcknowledge : onDismiss}
      primaryButtonText={primaryButtonText}
      secondaryButtonOnClick={announcement.primaryAction ? handlePrimaryAction : undefined}
      secondaryButtonText={secondaryButtonText}
      size="lg"
      testID="announcement-screen"
      title={announcement.title}
      visible
    >
      <Box direction="column" gap={3} maxHeight={Platform.OS === "web" ? 480 : 360}>
        <ScrollView>
          <MarkdownView>{announcement.body}</MarkdownView>
        </ScrollView>
        {announcement.publishedAt ? (
          <Text color="secondaryLight" size="sm">
            Published {announcement.publishedAt}
          </Text>
        ) : null}
      </Box>
    </Modal>
  );
};
