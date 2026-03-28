import React, {useState} from "react";
import {Pressable, ScrollView} from "react-native";

import {Box} from "./Box";
import {Button} from "./Button";
import {CheckBox} from "./CheckBox";
import {MarkdownView} from "./MarkdownView";
import {Modal} from "./Modal";
import {Page} from "./Page";
import {SignatureField} from "./SignatureField";
import {Text} from "./Text";
import type {ConsentFormPublic} from "./useConsentForms";

interface ConsentFormScreenProps {
  form: ConsentFormPublic;
  isSubmitting?: boolean;
  locale: string;
  onAgree: (data: {checkboxValues: Record<string, boolean>; signature?: string}) => void;
  onDecline?: () => void;
}

export const ConsentFormScreen: React.FC<ConsentFormScreenProps> = ({
  form,
  isSubmitting = false,
  locale,
  onAgree,
  onDecline,
}) => {
  const [checkboxValues, setCheckboxValues] = useState<Record<string, boolean>>({});
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(!form.requireScrollToBottom);
  const [signatureValue, setSignatureValue] = useState<string | undefined>(undefined);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [confirmModalCheckboxIndex, setConfirmModalCheckboxIndex] = useState<number | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [contentHeight, setContentHeight] = useState(0);
  const [layoutHeight, setLayoutHeight] = useState(0);

  const content = form.content[locale] ?? form.content[form.defaultLocale] ?? "";

  const allRequiredCheckboxesChecked = form.checkboxes.every((checkbox, index) => {
    if (!checkbox.required) {
      return true;
    }
    return checkboxValues[index.toString()] === true;
  });

  const signatureProvided = !form.captureSignature || Boolean(signatureValue);

  const canAgree = hasScrolledToBottom && allRequiredCheckboxesChecked && signatureProvided;

  // Auto-satisfy scroll requirement when content fits within the viewport
  const handleContentSizeChange = (_w: number, h: number) => {
    setContentHeight(h);
    if (!hasScrolledToBottom && h > 0 && layoutHeight > 0 && h <= layoutHeight) {
      setHasScrolledToBottom(true);
    }
  };

  const handleLayout = (event: any) => {
    const h = event.nativeEvent.layout.height;
    setLayoutHeight(h);
    if (!hasScrolledToBottom && contentHeight > 0 && h > 0 && contentHeight <= h) {
      setHasScrolledToBottom(true);
    }
  };

  const handleScroll = (event: any) => {
    if (hasScrolledToBottom) {
      return;
    }
    const {contentOffset, contentSize, layoutMeasurement} = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromBottom <= 20) {
      setHasScrolledToBottom(true);
    }
  };

  const handleCheckboxPress = (index: number) => {
    const checkbox = form.checkboxes[index];
    const key = index.toString();
    const currentValue = checkboxValues[key] ?? false;

    if (checkbox.confirmationPrompt && !currentValue) {
      // Show confirmation modal before toggling on
      setConfirmModalCheckboxIndex(index);
      setConfirmModalVisible(true);
    } else {
      setCheckboxValues((prev) => ({...prev, [key]: !currentValue}));
    }
  };

  const handleConfirmModalConfirm = () => {
    if (confirmModalCheckboxIndex !== null) {
      const key = confirmModalCheckboxIndex.toString();
      setCheckboxValues((prev) => ({...prev, [key]: true}));
    }
    setConfirmModalVisible(false);
    setConfirmModalCheckboxIndex(null);
  };

  const handleConfirmModalDismiss = () => {
    setConfirmModalVisible(false);
    setConfirmModalCheckboxIndex(null);
  };

  const handleAgree = () => {
    onAgree({checkboxValues, signature: signatureValue});
  };

  const confirmingCheckbox =
    confirmModalCheckboxIndex !== null ? form.checkboxes[confirmModalCheckboxIndex] : null;

  const footer = (
    <Box direction="column" gap={2} paddingY={2} testID="consent-form-footer" width="100%">
      {Boolean(form.allowDecline && onDecline) && (
        <Box width="100%">
          <Button
            fullWidth
            onClick={onDecline!}
            testID="consent-form-decline-button"
            text={form.declineButtonText}
            variant="muted"
          />
        </Box>
      )}
      <Box width="100%">
        <Button
          disabled={!canAgree}
          fullWidth
          loading={isSubmitting}
          onClick={handleAgree}
          testID="consent-form-agree-button"
          text={form.agreeButtonText}
        />
      </Box>
    </Box>
  );

  return (
    <Page footer={footer} scroll={false} title={form.title}>
      <ScrollView
        onContentSizeChange={handleContentSizeChange}
        onLayout={handleLayout}
        onScroll={handleScroll}
        scrollEnabled={scrollEnabled}
        scrollEventThrottle={16}
        style={{flex: 1}}
        testID="consent-form-scroll-view"
      >
        <Box direction="column" gap={3} paddingY={2}>
          <MarkdownView>{content}</MarkdownView>

          {form.checkboxes.length > 0 && (
            <Box direction="column" gap={2} testID="consent-form-checkboxes">
              {form.checkboxes.map((checkbox, index) => {
                const key = index.toString();
                const isChecked = checkboxValues[key] ?? false;

                return (
                  <Pressable
                    key={key}
                    onPress={() => handleCheckboxPress(index)}
                    testID={`consent-form-checkbox-${index}`}
                  >
                    <Box alignItems="center" direction="row" gap={2}>
                      <CheckBox selected={isChecked} size="md" />
                      <Box flex="grow">
                        <Text size="md">
                          {checkbox.label}
                          {checkbox.required && " *"}
                        </Text>
                      </Box>
                    </Box>
                  </Pressable>
                );
              })}
            </Box>
          )}

          {Boolean(form.captureSignature) && (
            <Box direction="column" gap={2} testID="consent-form-signature">
              <SignatureField
                onChange={(value) => setSignatureValue(value)}
                onEnd={() => setScrollEnabled(true)}
                onStart={() => setScrollEnabled(false)}
                title="Signature"
                value={signatureValue}
              />
            </Box>
          )}

          {Boolean(form.requireScrollToBottom && !hasScrolledToBottom) && (
            <Box paddingY={2} testID="consent-form-scroll-hint">
              <Text color="secondaryDark" size="sm">
                Please scroll to the bottom to continue.
              </Text>
            </Box>
          )}
        </Box>
      </ScrollView>

      {confirmingCheckbox && (
        <Modal
          onDismiss={handleConfirmModalDismiss}
          primaryButtonOnClick={handleConfirmModalConfirm}
          primaryButtonText="Confirm"
          secondaryButtonOnClick={handleConfirmModalDismiss}
          secondaryButtonText="Cancel"
          text={confirmingCheckbox.confirmationPrompt}
          title="Please confirm"
          visible={confirmModalVisible}
        />
      )}
    </Page>
  );
};
