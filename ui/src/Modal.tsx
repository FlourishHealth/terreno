import {type FC, useEffect, useRef} from "react";
import {Dimensions, type DimensionValue, Pressable, Modal as RNModal, View} from "react-native";
import ActionSheet, {type ActionSheetRef} from "react-native-actions-sheet";
import {Gesture, GestureDetector} from "react-native-gesture-handler";
import {runOnJS} from "react-native-reanimated";

import {Button} from "./Button";
import type {ModalProps} from "./Common";
import {Heading} from "./Heading";
import {Icon} from "./Icon";
import {isMobileDevice} from "./MediaQuery";
import {Text} from "./Text";
import {useTheme} from "./Theme";
import {isNative} from "./Utilities";

const getModalSize = (size: "sm" | "md" | "lg"): DimensionValue => {
  const sizeMap = {
    lg: 900,
    md: 720,
    sm: 540,
  };
  let sizePx: DimensionValue = sizeMap[size] || sizeMap.sm;
  if (sizePx > Dimensions.get("window").width) {
    sizePx = "90%";
  }
  return sizePx;
};

const ModalContent: FC<{
  children?: ModalProps["children"];
  title?: ModalProps["title"];
  subtitle?: ModalProps["subtitle"];
  text?: ModalProps["text"];
  primaryButtonText?: ModalProps["primaryButtonText"];
  primaryButtonDisabled?: ModalProps["primaryButtonDisabled"];
  secondaryButtonText?: ModalProps["secondaryButtonText"];
  primaryButtonOnClick?: ModalProps["primaryButtonOnClick"];
  secondaryButtonOnClick?: ModalProps["secondaryButtonOnClick"];
  onDismiss: ModalProps["onDismiss"];
  sizePx: DimensionValue;
  theme: any;
  isMobile: boolean;
}> = ({
  children,
  title,
  subtitle,
  text,
  primaryButtonText,
  primaryButtonDisabled,
  secondaryButtonText,
  primaryButtonOnClick,
  secondaryButtonOnClick,
  onDismiss,
  sizePx,
  theme,
  isMobile,
}) => {
  return (
    <View
      style={{
        alignItems: "center",
        alignSelf: "center",
        backgroundColor: theme.surface.base,
        borderRadius: theme.radius.default,
        maxHeight: "100%",
        padding: 32,
        width: sizePx,
        zIndex: 1,
        ...(isMobile
          ? {}
          : {
              boxShadow: "0px 4px 24px rgba(0, 0, 0, 0.5)",
              elevation: 24,
              margin: "auto",
            }),
      }}
    >
      <View style={{alignSelf: "flex-end", position: "relative"}}>
        <Pressable
          accessibilityHint="Closes the modal"
          aria-label="Close modal"
          aria-role="button"
          onPress={onDismiss}
          style={{
            alignItems: "center",
            bottom: -8,
            flex: 1,
            justifyContent: "center",
            left: -8,
            position: "absolute",
            right: -8,
            top: -8,
          }}
        >
          <Icon iconName="x" size="sm" />
        </Pressable>
      </View>
      {title && (
        <View
          accessibilityHint="Modal title"
          aria-label={title}
          aria-role="header"
          style={{alignSelf: "flex-start"}}
        >
          <Heading size="lg">{title}</Heading>
        </View>
      )}
      {subtitle && (
        <View
          accessibilityHint="Modal Sub Heading Text"
          aria-label={subtitle}
          aria-role="text"
          style={{alignSelf: "flex-start", marginTop: subtitle ? 8 : 0}}
        >
          <Text size="lg">{subtitle}</Text>
        </View>
      )}
      {text && (
        <View
          accessibilityHint="Modal body text"
          aria-label={text}
          aria-role="text"
          style={{alignSelf: "flex-start", marginVertical: text ? 12 : 0}}
        >
          <Text>{text}</Text>
        </View>
      )}
      {children && (
        <View
          style={{
            flex: isMobile ? undefined : 1,
            marginTop: text ? 0 : 12,
            width: "100%",
          }}
        >
          {children}
        </View>
      )}
      <View
        style={{
          alignSelf: "flex-end",
          flexDirection: "row",
          marginTop: text && !children ? 20 : 32,
        }}
      >
        {Boolean(secondaryButtonText && secondaryButtonOnClick) && (
          <View style={{marginRight: primaryButtonText ? 20 : 0}}>
            <Button
              onClick={secondaryButtonOnClick!}
              text={secondaryButtonText as string}
              variant="muted"
            />
          </View>
        )}
        {Boolean(primaryButtonText && primaryButtonOnClick) && (
          <Button
            disabled={primaryButtonDisabled}
            onClick={primaryButtonOnClick!}
            text={primaryButtonText as string}
          />
        )}
      </View>
    </View>
  );
};

export const Modal: FC<ModalProps> = ({
  children,
  persistOnBackgroundClick = false,
  primaryButtonDisabled = false,
  primaryButtonText,
  secondaryButtonText,
  size = "sm",
  subtitle,
  text,
  title,
  visible,
  onDismiss,
  primaryButtonOnClick,
  secondaryButtonOnClick,
}: ModalProps) => {
  const actionSheetRef = useRef<ActionSheetRef>(null);
  const {theme} = useTheme();

  const handleDismiss = () => {
    if (visible && onDismiss) {
      onDismiss();
    }
  };

  const handlePrimaryButtonClick = (
    value?: Parameters<NonNullable<ModalProps["primaryButtonOnClick"]>>[0]
  ) => {
    if (visible && primaryButtonOnClick) {
      return primaryButtonOnClick(value);
    }
  };

  const handleSecondaryButtonClick = (
    value?: Parameters<NonNullable<ModalProps["secondaryButtonOnClick"]>>[0]
  ) => {
    if (visible && secondaryButtonOnClick) {
      return secondaryButtonOnClick(value);
    }
  };

  const dragToClose = Gesture.Pan().onEnd((event) => {
    if (event.translationY > 20) {
      // Gesture callbacks run on the UI thread, runOnJS is required to safely invoke handleDismiss on the JS thread
      runOnJS(handleDismiss)();
    }
  });

  // Open the action sheet ref when the visible prop changes.
  useEffect(() => {
    if (actionSheetRef.current) {
      actionSheetRef.current.setModalVisible(visible);
    }
  }, [visible]);

  const isMobile = isMobileDevice() && isNative();
  const sizePx = getModalSize(size);

  const modalContentProps = {
    isMobile,
    onDismiss: handleDismiss,
    persistOnBackgroundClick,
    primaryButtonDisabled,
    primaryButtonOnClick: handlePrimaryButtonClick,
    primaryButtonText,
    secondaryButtonOnClick: handleSecondaryButtonClick,
    secondaryButtonText,
    sizePx,
    subtitle,
    text,
    theme,
    title,
  };

  if (isMobile) {
    return (
      <ActionSheet
        closeOnTouchBackdrop={!persistOnBackgroundClick}
        gestureEnabled={false}
        // Disable ActionSheet's built-in gestures to avoid conflicts with scrolling
        onClose={handleDismiss}
        ref={actionSheetRef}
      >
        <View>
          {/* Attach our own swipe-to-dismiss gesture to the top handle */}
          <GestureDetector gesture={dragToClose}>
            <View
              accessibilityHint="Pull down to close the modal"
              aria-label="Pull down bar"
              aria-role="adjustable"
              // add hitSlop to make the bar easier to hit since it's small
              hitSlop={{bottom: 20, left: 50, right: 50, top: 20}}
              style={{
                alignItems: "center",
                alignSelf: "center",
                backgroundColor: "#9A9A9A",
                borderRadius: 5,
                height: 3,
                justifyContent: "center",
                marginTop: 10,
                padding: 2,
                width: "30%",
              }}
            />
          </GestureDetector>

          <ModalContent {...modalContentProps}>{children}</ModalContent>
        </View>
      </ActionSheet>
    );
  } else {
    return (
      <RNModal animationType="slide" onRequestClose={handleDismiss} transparent visible={visible}>
        <Pressable
          onPress={persistOnBackgroundClick ? undefined : handleDismiss}
          style={{
            alignItems: "center",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            flex: 1,
            justifyContent: "center",
          }}
        >
          <Pressable
            onPress={(e) => {
              persistOnBackgroundClick ? null : e.stopPropagation();
            }}
            style={{cursor: "auto"}}
          >
            <ModalContent {...modalContentProps}>{children}</ModalContent>
          </Pressable>
        </Pressable>
      </RNModal>
    );
  }
};
