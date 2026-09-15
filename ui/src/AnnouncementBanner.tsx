import React, {useCallback} from "react";
import {Linking} from "react-native";

import {Banner} from "./Banner";
import {Box} from "./Box";
import {DismissButton} from "./DismissButton";
import type {AnnouncementPublic} from "./useAnnouncements";

export interface AnnouncementBannerProps {
  announcement: AnnouncementPublic;
  isSubmitting?: boolean;
  onAcknowledge: () => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
  requiresAcknowledgement: boolean;
  testID?: string;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  announcement,
  isSubmitting = false,
  onAcknowledge,
  onDismiss,
  requiresAcknowledgement,
  testID = "announcement-banner",
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

  const handleAcknowledgeOrDismiss = useCallback(async (): Promise<void> => {
    if (requiresAcknowledgement) {
      await onAcknowledge();
      return;
    }
    await onDismiss();
  }, [onAcknowledge, onDismiss, requiresAcknowledgement]);

  const primaryActionLabel = announcement.primaryAction?.label;
  const hasPrimaryAction = Boolean(primaryActionLabel && announcement.primaryAction?.url);

  let buttonText: string | undefined;
  let buttonOnClick: (() => void | Promise<void>) | undefined;

  if (requiresAcknowledgement) {
    buttonText = "Got it";
    buttonOnClick = handleAcknowledgeOrDismiss;
  } else if (hasPrimaryAction) {
    buttonText = primaryActionLabel;
    buttonOnClick = handlePrimaryAction;
  } else {
    buttonText = "Dismiss";
    buttonOnClick = handleAcknowledgeOrDismiss;
  }

  const showDismissButton = !requiresAcknowledgement && hasPrimaryAction;

  const bannerButtonProps =
    buttonText && buttonOnClick
      ? {
          buttonOnClick: isSubmitting ? async () => undefined : buttonOnClick,
          buttonText,
        }
      : {};

  return (
    <Box direction="row" testID={testID} width="100%">
      <Box flex="grow">
        <Banner text={announcement.title} {...bannerButtonProps} />
      </Box>
      {showDismissButton ? (
        <Box alignItems="center" justifyContent="center" paddingX={2}>
          <DismissButton
            accessibilityHint="Press to dismiss announcement"
            accessibilityLabel="Dismiss announcement"
            color="inverted"
            onClick={isSubmitting ? () => undefined : onDismiss}
          />
        </Box>
      ) : null}
    </Box>
  );
};
