import type {FC} from "react";
import {Pressable, ScrollView} from "react-native";

import {Box} from "./Box";
import {Button} from "./Button";
import type {DocumentPopoverProps} from "./Common";
import {DismissButton} from "./DismissButton";
import {Icon} from "./Icon";
import {Spinner} from "./Spinner";
import {Text} from "./Text";
import {ThumbsUpDownFeedback} from "./ThumbsUpDownFeedback";

const DEFAULT_CONTENT_HEIGHT = 240;
const DEFAULT_WIDTH = 320;

/**
 * A popover that previews a single document: a header with the document's title and date, the
 * document body, and a footer with an "Open" action and optional thumbs up/down feedback.
 *
 * Rendering is driven by `status`: "loading" shows a centered spinner under a loading header,
 * "error" shows a retryable error message, and "loaded" shows the document itself. The popover
 * is a plain card, so the consumer is responsible for positioning it next to its anchor.
 */
export const DocumentPopover: FC<DocumentPopoverProps> = ({
  children,
  contentHeight = DEFAULT_CONTENT_HEIGHT,
  errorText = "Something went wrong while loading this document. Check your connection and try again.",
  errorTitle = "Couldn't load this document",
  feedback,
  loadingText = "Loading document...",
  onClose,
  onFeedbackChange,
  onOpen,
  onRetry,
  openText = "Open",
  retryText = "Try again",
  status = "loaded",
  subtitle,
  testID,
  text,
  title,
  width = DEFAULT_WIDTH,
}) => {
  const childTestID = (suffix: string) => (testID ? `${testID}-${suffix}` : undefined);

  const renderCloseButton = () => (
    <DismissButton
      accessibilityHint="Closes the document preview"
      accessibilityLabel="Close document"
      onClick={() => {
        void onClose();
      }}
    />
  );

  const renderContent = () => {
    if (status === "loading") {
      return (
        <Box alignItems="center" height={contentHeight} justifyContent="center" width="100%">
          <Spinner color="secondary" testID={childTestID("spinner")} />
        </Box>
      );
    }

    if (status === "error") {
      return (
        <Box
          alignItems="center"
          gap={3}
          height={contentHeight}
          justifyContent="center"
          paddingX={4}
          width="100%"
        >
          <Box
            alignItems="center"
            color="errorLight"
            height={48}
            justifyContent="center"
            rounding="circle"
            width={48}
          >
            <Icon color="error" iconName="triangle-exclamation" size="lg" type="solid" />
          </Box>
          <Text align="center" bold testID={childTestID("error-title")}>
            {errorTitle}
          </Text>
          <Text align="center" color="secondaryLight" size="sm">
            {errorText}
          </Text>
          {Boolean(onRetry) && (
            <Button
              onClick={onRetry!}
              size="sm"
              testID={childTestID("retry")}
              text={retryText}
              variant="primary"
            />
          )}
        </Box>
      );
    }

    return (
      <ScrollView style={{height: contentHeight, width: "100%"}}>
        <Box paddingX={4} paddingY={3} width="100%">
          {children ?? (Boolean(text) && <Text size="sm">{text}</Text>)}
        </Box>
      </ScrollView>
    );
  };

  const showFooter = status === "loaded" && (Boolean(onOpen) || Boolean(onFeedbackChange));

  return (
    <Box color="base" rounding="md" shadow testID={testID} width={width}>
      <Box
        alignItems="center"
        borderBottom="default"
        direction="row"
        gap={2}
        paddingX={4}
        paddingY={3}
      >
        <Box flex="grow">
          {status === "loaded" ? (
            <>
              {Boolean(title) && (
                <Text bold testID={childTestID("title")}>
                  {title}
                </Text>
              )}
              {Boolean(subtitle) && (
                <Text color="secondaryLight" size="sm" testID={childTestID("subtitle")}>
                  {subtitle}
                </Text>
              )}
            </>
          ) : status === "loading" ? (
            <Text color="secondaryLight" testID={childTestID("loading-text")}>
              {loadingText}
            </Text>
          ) : null}
        </Box>
        {renderCloseButton()}
      </Box>

      {renderContent()}

      {showFooter && (
        <Box
          alignItems="center"
          borderTop="default"
          direction="row"
          justifyContent="between"
          paddingX={4}
          paddingY={3}
        >
          {onOpen ? (
            <Pressable
              accessibilityRole="button"
              aria-label={openText}
              onPress={onOpen}
              testID={childTestID("open")}
            >
              <Box alignItems="center" direction="row" gap={2}>
                <Text bold color="link" size="sm">
                  {openText}
                </Text>
                <Icon color="link" iconName="arrow-up-right-from-square" size="sm" type="regular" />
              </Box>
            </Pressable>
          ) : (
            <Box />
          )}
          {Boolean(onFeedbackChange) && (
            <ThumbsUpDownFeedback
              onChange={onFeedbackChange!}
              testID={childTestID("feedback")}
              value={feedback}
            />
          )}
        </Box>
      )}
    </Box>
  );
};
