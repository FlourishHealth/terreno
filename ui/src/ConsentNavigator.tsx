import React, {useState} from "react";

import {Box} from "./Box";
import {Button} from "./Button";
import {ConsentFormScreen} from "./ConsentFormScreen";
import {Spinner} from "./Spinner";
import {Text} from "./Text";
import {detectLocale, useConsentForms} from "./useConsentForms";
import type {SubmitConsentBody} from "./useSubmitConsent";
import {useSubmitConsent} from "./useSubmitConsent";

interface ConsentNavigatorProps {
  api: any;
  baseUrl?: string;
  children: React.ReactNode;
  onError?: (error: any) => void;
}

export const ConsentNavigator: React.FC<ConsentNavigatorProps> = ({
  api,
  baseUrl,
  children,
  onError,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const {forms, isLoading, error, refetch} = useConsentForms(api, baseUrl);
  const {submit, isSubmitting} = useSubmitConsent(api, baseUrl);
  const locale = detectLocale();

  if (isLoading) {
    console.debug("[ConsentNavigator] Loading pending consents...");
    return (
      <Box
        alignItems="center"
        flex="grow"
        justifyContent="center"
        testID="consent-navigator-loading"
      >
        <Spinner />
      </Box>
    );
  }

  if (error) {
    console.warn("[ConsentNavigator] Error fetching pending consents:", error);
    onError?.(error);
    return (
      <Box
        alignItems="center"
        direction="column"
        flex="grow"
        gap={3}
        justifyContent="center"
        padding={6}
        testID="consent-navigator-error"
      >
        <Text align="center" color="error" size="lg">
          Failed to load consent forms
        </Text>
        <Button onClick={refetch} text="Retry" />
      </Box>
    );
  }

  if (forms.length === 0 || currentIndex >= forms.length) {
    console.debug("[ConsentNavigator] No pending consents, showing app");
    return <>{children}</>;
  }

  console.info(`[ConsentNavigator] Showing consent form ${currentIndex + 1}/${forms.length}: ${forms[currentIndex]?.title}`);

  const currentForm = forms[currentIndex];

  const handleAgree = async (data: {
    checkboxValues: Record<string, boolean>;
    signature?: string;
  }) => {
    const body: SubmitConsentBody = {
      agreed: true,
      checkboxValues: data.checkboxValues,
      consentFormId: currentForm.id,
      locale,
      signature: data.signature,
    };

    try {
      await submit(body);
      if (currentIndex + 1 >= forms.length) {
        await refetch();
        setCurrentIndex(0);
      } else {
        setCurrentIndex(currentIndex + 1);
      }
    } catch (err) {
      onError?.(err);
    }
  };

  const handleDecline = async () => {
    try {
      await submit({
        agreed: false,
        consentFormId: currentForm.id,
        locale,
      });
    } catch (err) {
      onError?.(err);
    }
    if (currentIndex + 1 >= forms.length) {
      await refetch();
      setCurrentIndex(0);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  return (
    <ConsentFormScreen
      form={currentForm}
      isSubmitting={isSubmitting}
      locale={locale}
      onAgree={handleAgree}
      onDecline={currentForm.required ? undefined : handleDecline}
    />
  );
};
