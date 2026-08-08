import {ConsentFormScreen} from "@terreno/ui";
import {type ReactElement, useCallback} from "react";

const consentForm = {
  active: true,
  agreeButtonText: "I agree",
  allowDecline: true,
  captureSignature: true,
  checkboxes: [{label: "I have read and understand this consent form.", required: true}],
  content: {
    en: "Please review this consent form. The signature area should fit within the card and the action buttons should share one row.",
  },
  declineButtonText: "Decline",
  defaultLocale: "en",
  id: "demo-consent",
  order: 0,
  required: true,
  requireScrollToBottom: false,
  slug: "demo-consent",
  title: "Consent Form",
  type: "agreement",
  version: 1,
};

export const ConsentFormScreenDemo: React.FC = (): ReactElement => {
  const handleAgree = useCallback((): void => {}, []);
  const handleDecline = useCallback((): void => {}, []);

  return (
    <ConsentFormScreen
      form={consentForm}
      locale="en"
      onAgree={handleAgree}
      onDecline={handleDecline}
    />
  );
};
