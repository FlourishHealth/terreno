import React, {useCallback, useEffect, useRef, useState} from "react";

import {Box} from "./Box";
import {ConsentFormScreen} from "./ConsentFormScreen";
import {Heading} from "./Heading";
import {Spinner} from "./Spinner";
import {Text} from "./Text";
import {detectLocale} from "./useConsentForms";
import type {SubmitConsentViaLinkBody} from "./useConsentLink";
import {useConsentLink} from "./useConsentLink";

interface ConsentLinkScreenProps {
  // biome-ignore lint/suspicious/noExplicitAny: RTK Query api instance is a complex generic type
  api: any;
  token: string;
  baseUrl?: string;
  onComplete?: () => void;
  onError?: (error: unknown) => void;
  variables?: Record<string, string>;
}

const INVALID_LINK_MESSAGE = "This consent link is invalid or has already been used.";
const EXPIRED_LINK_MESSAGE = "This consent link has expired or is no longer available.";

const getErrorMessage = (error: unknown): string => {
  const errorObj = error as {
    status?: number;
    originalStatus?: number;
    data?: {title?: string};
  };
  const status = errorObj?.status ?? errorObj?.originalStatus;
  if (errorObj?.data?.title) {
    return errorObj.data.title;
  }
  if (status === 410) {
    return EXPIRED_LINK_MESSAGE;
  }
  return INVALID_LINK_MESSAGE;
};

/**
 * Public screen for completing consent forms via a signed link, without an
 * authenticated session. Renders each pending form in sequence, then a
 * completion state.
 */
export const ConsentLinkScreen: React.FC<ConsentLinkScreenProps> = ({
  api,
  token,
  baseUrl,
  onComplete,
  onError,
  variables,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completed, setCompleted] = useState(false);
  const hasCompletedRef = useRef(false);
  const {forms, isLoading, error, submit, isSubmitting} = useConsentLink(api, token, baseUrl);
  const locale = detectLocale();

  // Complete when the link had no pending forms, or after the last form is submitted.
  // We advance through the forms loaded up front rather than refetching, because a
  // single-use link is consumed on submit and a refetch would fail.
  const isComplete = completed || (Boolean(token) && !isLoading && !error && forms.length === 0);

  // Notify the consumer once when all forms for the link are completed.
  useEffect(() => {
    if (isComplete && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete?.();
    }
  }, [isComplete, onComplete]);

  const advanceAfterSubmit = useCallback((): void => {
    setCurrentIndex((index) => {
      const nextIndex = index + 1;
      if (nextIndex >= forms.length) {
        setCompleted(true);
        return index;
      }
      return nextIndex;
    });
  }, [forms.length]);

  const handleAgree = useCallback(
    async (data: {checkboxValues: Record<string, boolean>; signature?: string}): Promise<void> => {
      const currentForm = forms[currentIndex];
      if (!currentForm) {
        return;
      }
      const body: SubmitConsentViaLinkBody = {
        agreed: true,
        checkboxValues: data.checkboxValues,
        consentFormId: currentForm.id,
        locale,
        signature: data.signature,
      };
      try {
        await submit(body);
        advanceAfterSubmit();
      } catch (err) {
        console.warn("[ConsentLinkScreen] Failed to submit consent via link", {error: err});
        onError?.(err);
      }
    },
    [advanceAfterSubmit, currentIndex, forms, locale, onError, submit]
  );

  const handleDecline = useCallback(async (): Promise<void> => {
    const currentForm = forms[currentIndex];
    if (!currentForm) {
      return;
    }
    try {
      await submit({agreed: false, consentFormId: currentForm.id, locale});
      advanceAfterSubmit();
    } catch (err) {
      console.warn("[ConsentLinkScreen] Failed to decline consent via link", {error: err});
      onError?.(err);
    }
  }, [advanceAfterSubmit, currentIndex, forms, locale, onError, submit]);

  if (!token) {
    return (
      <Box
        alignItems="center"
        flex="grow"
        gap={3}
        justifyContent="center"
        padding={6}
        testID="consent-link-invalid"
      >
        <Text align="center" color="error" size="lg">
          {INVALID_LINK_MESSAGE}
        </Text>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box alignItems="center" flex="grow" justifyContent="center" testID="consent-link-loading">
        <Spinner />
      </Box>
    );
  }

  if (isComplete) {
    return (
      <Box
        alignItems="center"
        flex="grow"
        gap={3}
        justifyContent="center"
        padding={6}
        testID="consent-link-complete"
      >
        <Heading align="center" size="lg">
          Thank you
        </Heading>
        <Text align="center" size="md">
          You have completed all required consent forms.
        </Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        alignItems="center"
        flex="grow"
        gap={3}
        justifyContent="center"
        padding={6}
        testID="consent-link-error"
      >
        <Text align="center" color="error" size="lg">
          {getErrorMessage(error)}
        </Text>
      </Box>
    );
  }

  const currentForm = forms[currentIndex];

  return (
    <ConsentFormScreen
      form={currentForm}
      isSubmitting={isSubmitting}
      locale={locale}
      onAgree={handleAgree}
      onDecline={currentForm.required ? undefined : handleDecline}
      variables={variables}
    />
  );
};
