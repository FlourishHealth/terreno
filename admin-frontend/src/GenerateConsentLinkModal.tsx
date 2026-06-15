import {Box, Button, Modal, NumberField, Text, TextField} from "@terreno/ui";
import React, {useCallback, useMemo, useState} from "react";
import {type AdminApi, type EndpointBuilder, resolveAdminBases} from "./types";

interface GenerateConsentLinkModalProps {
  api: AdminApi;
  /** The user the generated link will allow to complete consents. */
  userId: string;
  visible: boolean;
  onDismiss: () => void;
  /** Base path where the /consents routes are mounted. Defaults to "" (root). */
  consentsBase?: string;
  /** Optionally scope the link to specific consent form ids. */
  consentFormIds?: string[];
}

interface GeneratedLink {
  _id: string;
  expiresAt: string;
  token: string;
  url: string;
}

const useGenerateConsentLink = (
  api: AdminApi,
  consentsBase: string
): [
  (body: Record<string, unknown>) => {unwrap: () => Promise<GeneratedLink>},
  {isLoading: boolean},
] => {
  const enhancedApi = useMemo(() => {
    return api.injectEndpoints({
      endpoints: (build: EndpointBuilder) => ({
        adminGenerateConsentLink: build.mutation({
          query: (body: Record<string, unknown>) => ({
            body,
            method: "POST",
            url: `${consentsBase}/consents/links`,
          }),
        }),
      }),
      overrideExisting: true,
    });
  }, [api, consentsBase]);

  // biome-ignore lint/suspicious/noExplicitAny: dynamic hook lookup on RTK Query enhanced API
  return (enhancedApi as any).useAdminGenerateConsentLinkMutation();
};

export const GenerateConsentLinkModal: React.FC<GenerateConsentLinkModalProps> = ({
  api,
  userId,
  visible,
  onDismiss,
  consentsBase,
  consentFormIds,
}) => {
  const {apiBase} = resolveAdminBases({apiBase: consentsBase, baseUrl: consentsBase});
  const [expiresIn, setExpiresIn] = useState("14d");
  const [maxUses, setMaxUses] = useState("1");
  const [note, setNote] = useState("");
  const [generatedLink, setGeneratedLink] = useState<GeneratedLink | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [generate, {isLoading}] = useGenerateConsentLink(api, apiBase);

  const handleGenerate = useCallback(async (): Promise<void> => {
    setErrorMessage(null);
    setCopied(false);
    try {
      const parsedMaxUses = Number.parseInt(maxUses, 10);
      const result = await generate({
        consentFormIds,
        expiresIn,
        maxUses: Number.isFinite(parsedMaxUses) ? parsedMaxUses : 1,
        note: note || undefined,
        userId,
      }).unwrap();
      setGeneratedLink(result);
    } catch (err) {
      console.warn("[GenerateConsentLinkModal] Failed to generate link", {error: err});
      setErrorMessage("Failed to generate link. Please try again.");
    }
  }, [consentFormIds, expiresIn, generate, maxUses, note, userId]);

  const handleCopy = useCallback(async (): Promise<void> => {
    if (!generatedLink) {
      return;
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(generatedLink.url);
        setCopied(true);
      } catch (err) {
        console.warn("[GenerateConsentLinkModal] Failed to copy link", {error: err});
      }
    }
  }, [generatedLink]);

  const handleDismiss = useCallback((): void => {
    setGeneratedLink(null);
    setErrorMessage(null);
    setCopied(false);
    onDismiss();
  }, [onDismiss]);

  return (
    <Modal
      onDismiss={handleDismiss}
      primaryButtonOnClick={generatedLink ? handleDismiss : handleGenerate}
      primaryButtonText={generatedLink ? "Done" : isLoading ? "Generating..." : "Generate Link"}
      secondaryButtonOnClick={handleDismiss}
      secondaryButtonText="Cancel"
      size="md"
      title="Generate Signed Consent Link"
      visible={visible}
    >
      <Box gap={4} padding={2} testID="generate-consent-link-modal">
        {generatedLink ? (
          <Box gap={3}>
            <Text bold>Link generated</Text>
            <Text color="warning">
              This link is shown only once. Copy it now — it cannot be retrieved later.
            </Text>
            <Box border="default" padding={3} rounding="sm">
              <Text testID="generate-consent-link-url">{generatedLink.url}</Text>
            </Box>
            <Button
              iconName="copy"
              onClick={handleCopy}
              testID="generate-consent-link-copy"
              text={copied ? "Copied" : "Copy Link"}
              variant="outline"
            />
          </Box>
        ) : (
          <Box gap={3}>
            <Text color="secondaryDark">
              Generate a link that lets this user complete their pending consent forms without
              logging in.
            </Text>
            <TextField
              onChange={setExpiresIn}
              placeholder="14d"
              testID="generate-consent-link-expires-input"
              title="Expires In (e.g. 14d, 48h)"
              value={expiresIn}
            />
            <NumberField
              onChange={setMaxUses}
              testID="generate-consent-link-max-uses-input"
              title="Max Uses (0 = unlimited)"
              type="number"
              value={maxUses}
            />
            <TextField
              onChange={setNote}
              placeholder="Optional note"
              testID="generate-consent-link-note-input"
              title="Note (optional)"
              value={note}
            />
            {errorMessage ? (
              <Text color="error" testID="generate-consent-link-error">
                {errorMessage}
              </Text>
            ) : null}
          </Box>
        )}
      </Box>
    </Modal>
  );
};
