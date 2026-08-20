import type {FC, ReactNode} from "react";
import {Pressable, ScrollView} from "react-native";

import {Box} from "./Box";
import {Button} from "./Button";
import type {PopoverProps} from "./Common";
import {DismissButton} from "./DismissButton";
import {Heading} from "./Heading";
import {Icon} from "./Icon";
import {Spinner} from "./Spinner";
import {Text} from "./Text";
import {ThumbsUpDownFeedback} from "./ThumbsUpDownFeedback";

const DEFAULT_HEIGHT = 480;
const DEFAULT_WIDTH = 480;
const ERROR_ICON_SIZE = 64;

/**
 * A popover that previews a single document: a header with the document's title and date, the
 * document body, and a footer with an "Open" action and optional thumbs up/down feedback.
 *
 * Rendering is driven by `status`: "loading" shows a centered spinner under a loading header,
 * "error" shows a retryable error message centered in the card, and "loaded" shows the document
 * itself. The popover keeps the same size in every state, and is a plain card, so the consumer is
 * responsible for positioning it next to its anchor.
 */
export const Popover: FC<PopoverProps> = ({
  children,
  errorText = "Something went wrong while loading this document. Check your connection and try again.",
  errorTitle = "Couldn't load this document",
  feedback,
  height = DEFAULT_HEIGHT,
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

  const closeButton = (
    <DismissButton
      accessibilityHint="Closes the document preview"
      accessibilityLabel="Close document"
      color="link"
      onClick={() => {
        void onClose();
      }}
    />
  );

  const card = (content: ReactNode) => (
    <Box
      color="base"
      height={height}
      overflow="hidden"
      rounding="md"
      shadow
      testID={testID}
      width={width}
    >
      {content}
    </Box>
  );

  // The error state has no header or footer: the close button floats over a centered message.
  if (status === "error") {
    return card(
      <>
        <Box paddingX={4} paddingY={4} position="absolute" right top zIndex={1}>
          {closeButton}
        </Box>
        <Box
          alignItems="center"
          flex="grow"
          gap={4}
          justifyContent="center"
          paddingX={6}
          width="100%"
        >
          <Box
            alignItems="center"
            color="errorLight"
            height={ERROR_ICON_SIZE}
            justifyContent="center"
            rounding="circle"
            width={ERROR_ICON_SIZE}
          >
            <Icon color="error" iconName="triangle-exclamation" size="xl" type="solid" />
          </Box>
          <Heading align="center" size="md" testID={childTestID("error-title")}>
            {errorTitle}
          </Heading>
          <Text align="center">{errorText}</Text>
          {Boolean(onRetry) && (
            // Button pins itself to flex-start, so center it on the row's main axis instead.
            <Box direction="row" justifyContent="center" width="100%">
              <Button
                onClick={onRetry!}
                testID={childTestID("retry")}
                text={retryText}
                variant="primary"
              />
            </Box>
          )}
        </Box>
      </>
    );
  }

  const body =
    status === "loading" ? (
      <Box alignItems="center" flex="grow" justifyContent="center" width="100%">
        <Spinner color="secondary" testID={childTestID("spinner")} />
      </Box>
    ) : (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        style={{flexBasis: 0, flexGrow: 1, flexShrink: 1, minHeight: 0, width: "100%"}}
        testID={childTestID("content")}
      >
        <Box paddingX={4} paddingY={3} width="100%">
          {children ?? (Boolean(text) && <Text>{text}</Text>)}
        </Box>
      </ScrollView>
    );

  const showFooter = status === "loaded" && (Boolean(onOpen) || Boolean(onFeedbackChange));

  return card(
    <>
      <Box
        alignItems="center"
        borderBottom="default"
        direction="row"
        gap={2}
        paddingX={4}
        paddingY={4}
      >
        <Box flex="grow">
          {status === "loaded" ? (
            <>
              {Boolean(title) && (
                <Heading size="sm" testID={childTestID("title")}>
                  {title}
                </Heading>
              )}
              {Boolean(subtitle) && (
                <Text size="sm" testID={childTestID("subtitle")}>
                  {subtitle}
                </Text>
              )}
            </>
          ) : (
            <Text color="secondaryLight" testID={childTestID("loading-text")}>
              {loadingText}
            </Text>
          )}
        </Box>
        {closeButton}
      </Box>

      {body}

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
                <Text bold color="link">
                  {openText}
                </Text>
                <Icon color="link" iconName="arrow-up-right-from-square" size="md" type="regular" />
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
    </>
  );
};
