import {Box, Button, Heading, Text, TextField, useStoredState} from "@terreno/ui";
import {DateTime} from "luxon";
import React, {useCallback, useMemo, useState} from "react";

import {AnchorControls} from "./AnchorControls";
import {ChatPanel} from "./ChatPanel";
import {CodeOutput} from "./CodeOutput";
import {ComponentPreview} from "./ComponentPreview";
import {ContrastReport} from "./ContrastReport";
import {generatePrimitivesFromAnchors, type PaletteAnchors} from "./colorUtils";
import {DEFAULT_GEMINI_MODEL, generatePaletteFromChat} from "./geminiClient";
import {PaletteRamps} from "./PaletteRamps";
import {
  type ChatMessage,
  DEFAULT_ANCHORS,
  type MainFamily,
  runContrastChecks,
  type StatusFamily,
} from "./paletteTypes";

/**
 * Top-level palette generator: a chat assistant (Gemini) plus manual color pickers on the left, and
 * a live, always-updating read-out on the right (full 000-900 ramps, WCAG contrast flags, a themed
 * component preview, and copy-pasteable export code). The LLM only chooses anchor colors; the ramps
 * and accessibility checks are computed deterministically so results are consistent and verifiable.
 */

type Family = MainFamily | StatusFamily;

let messageCounter = 0;
const nextId = (): string => {
  messageCounter += 1;
  return `msg-${Date.now()}-${messageCounter}`;
};

const makeMessage = (role: ChatMessage["role"], text: string): ChatMessage => ({
  createdAt: DateTime.now().toISO() ?? "",
  id: nextId(),
  role,
  text,
});

export const PaletteGenerator: React.FC = () => {
  const [apiKey, setApiKey, apiKeyLoading] = useStoredState<string>("palette-gemini-key", "");
  const [model, setModel] = useStoredState<string>("palette-gemini-model", DEFAULT_GEMINI_MODEL);

  const [anchors, setAnchors] = useState<PaletteAnchors>(DEFAULT_ANCHORS);
  const [selectedFamily, setSelectedFamily] = useState<Family>("primary");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const primitives = useMemo(
    () => generatePrimitivesFromAnchors(anchors) as Record<string, string>,
    [anchors]
  );
  const contrastResults = useMemo(() => runContrastChecks(primitives), [primitives]);

  const handleChangeAnchor = useCallback((family: Family, hex: string): void => {
    setAnchors((prev) => ({...prev, [family]: hex}));
  }, []);

  const handleSend = useCallback(
    async (text: string): Promise<void> => {
      if (!apiKey) {
        setError("Add your Gemini API key above to use the assistant.");
        return;
      }
      const userMessage = makeMessage("user", text);
      const history = [...messages, userMessage];
      setMessages(history);
      setIsLoading(true);
      setError(undefined);

      try {
        const {anchors: nextAnchors, explanation} = await generatePaletteFromChat({
          apiKey,
          currentAnchors: anchors,
          messages: history,
          model: model || DEFAULT_GEMINI_MODEL,
        });
        setAnchors(nextAnchors);
        setMessages((prev) => [...prev, makeMessage("assistant", explanation)]);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Something went wrong.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [anchors, apiKey, messages, model]
  );

  const handleReset = useCallback((): void => {
    setAnchors(DEFAULT_ANCHORS);
    setMessages([]);
    setError(undefined);
  }, []);

  return (
    <Box color="base" gap={5} height="100%" padding={4} scroll>
      <Box gap={2}>
        <Box alignItems="center" direction="row" gap={3} justifyContent="between" wrap>
          <Heading size="lg">AI Palette Generator</Heading>
          <Button onClick={handleReset} text="Reset palette" variant="muted" />
        </Box>
        <Text color="secondaryLight">
          Describe a vibe or set anchor colors, and Gemini builds a full Terreno palette. Every
          shade is generated deterministically, checked against WCAG contrast, and previewed on real
          components. Copy the exact theme code when you are happy.
        </Text>
      </Box>

      <Box border="default" gap={3} padding={4} rounding="md">
        <Heading size="sm">Gemini API key</Heading>
        <Text color="secondaryLight" size="sm">
          Uses the Gemini Developer API directly from your browser. Get a key at
          aistudio.google.com/apikey. Stored only on this device.
        </Text>
        <Box direction="column" gap={3} mdDirection="row">
          <Box flex="grow">
            <TextField
              disabled={apiKeyLoading}
              onChange={setApiKey}
              placeholder="AIza…"
              title="API key"
              type="password"
              value={apiKey}
            />
          </Box>
          <Box minWidth={220}>
            <TextField
              onChange={setModel}
              placeholder={DEFAULT_GEMINI_MODEL}
              title="Model"
              value={model}
            />
          </Box>
        </Box>
      </Box>

      <Box direction="column" gap={5} lgDirection="row">
        <Box flex="grow" gap={5} maxWidth={520}>
          <Box border="default" height={420} padding={4} rounding="md">
            <ChatPanel
              disabled={!apiKey}
              error={error}
              isLoading={isLoading}
              messages={messages}
              onSend={handleSend}
            />
          </Box>
          <Box border="default" gap={3} padding={4} rounding="md">
            <Heading size="sm">Anchor colors</Heading>
            <Text color="secondaryLight" size="sm">
              Tap a family to edit it. The anchor is the family's core (500) color; lighter and
              darker shades are generated from it.
            </Text>
            <AnchorControls
              anchors={anchors}
              onChangeAnchor={handleChangeAnchor}
              onSelectFamily={setSelectedFamily}
              selectedFamily={selectedFamily}
            />
          </Box>
        </Box>

        <Box flex="grow" gap={6}>
          <PaletteRamps primitives={primitives} />
          <ContrastReport results={contrastResults} />
          <ComponentPreview primitives={primitives} />
          <CodeOutput primitives={primitives} />
        </Box>
      </Box>
    </Box>
  );
};
