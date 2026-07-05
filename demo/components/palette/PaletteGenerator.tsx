import {Box, Button, Heading, SelectField, Text, TextField, useStoredState} from "@terreno/ui";
import {DateTime} from "luxon";
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";

import {AnchorControls} from "./AnchorControls";
import {ChatPanel} from "./ChatPanel";
import {CodeOutput} from "./CodeOutput";
import {ComponentPreview} from "./ComponentPreview";
import {ContrastReport} from "./ContrastReport";
import {generatePrimitivesFromAnchors, type PaletteAnchors} from "./colorUtils";
import {DarkModeAudit} from "./DarkModeAudit";
import {FontControls} from "./FontControls";
import {buildFontOptions, DEFAULT_FONTS, type FontSelection} from "./fonts";
import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_MODELS,
  generatePaletteFromChat,
  listGeminiModels,
} from "./geminiClient";
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
  const [fonts, setFonts] = useState<FontSelection>(DEFAULT_FONTS);
  const [fontRationale, setFontRationale] = useState<string | undefined>(undefined);
  const [selectedFamily, setSelectedFamily] = useState<Family>("primary");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [availableModels, setAvailableModels] = useState<string[]>(DEFAULT_GEMINI_MODELS);

  // Guards against overlapping generations: state updates are async, so a rapid second Send (or a
  // starter prompt) could otherwise start a concurrent request before `isLoading` re-renders.
  const generatingRef = useRef<boolean>(false);

  const resolvedModel = model || DEFAULT_GEMINI_MODEL;
  const modelOptions = useMemo(
    () => buildFontOptions(availableModels, resolvedModel),
    [availableModels, resolvedModel]
  );

  const handleModelChange = useCallback(
    (value: string): void => {
      void setModel(value);
    },
    [setModel]
  );

  const primitives = useMemo(
    () => generatePrimitivesFromAnchors(anchors) as Record<string, string>,
    [anchors]
  );
  const lightContrast = useMemo(() => runContrastChecks(primitives, "light"), [primitives]);
  const darkContrast = useMemo(() => runContrastChecks(primitives, "dark"), [primitives]);

  // Populate the model dropdown with the live set of chat models for the current key, falling back
  // to the curated defaults when no key is set or the listing fails.
  useEffect(() => {
    if (!apiKey) {
      setAvailableModels(DEFAULT_GEMINI_MODELS);
      return;
    }
    let cancelled = false;
    void listGeminiModels({apiKey}).then((models) => {
      if (!cancelled && models && models.length > 0) {
        setAvailableModels(models);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  const handleChangeAnchor = useCallback((family: Family, hex: string): void => {
    setAnchors((prev) => ({...prev, [family]: hex}));
  }, []);

  const handleSend = useCallback(
    async (text: string): Promise<void> => {
      if (!apiKey) {
        setError("Add your Gemini API key above to use the assistant.");
        return;
      }
      // Ignore overlapping sends; the ref updates synchronously, unlike isLoading.
      if (generatingRef.current) {
        return;
      }
      generatingRef.current = true;

      const userMessage = makeMessage("user", text);
      const history = [...messages, userMessage];
      setMessages(history);
      setIsLoading(true);
      setError(undefined);

      try {
        const result = await generatePaletteFromChat({
          apiKey,
          currentAnchors: anchors,
          currentFonts: fonts,
          messages: history,
          model: model || DEFAULT_GEMINI_MODEL,
        });
        setAnchors(result.anchors);
        setFonts(result.fonts);
        setFontRationale(result.fontRationale);
        const reply = result.fontRationale
          ? `${result.explanation}\n\nFonts: ${result.fontRationale}`
          : result.explanation;
        setMessages((prev) => [...prev, makeMessage("assistant", reply)]);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Something went wrong.";
        setError(message);
      } finally {
        generatingRef.current = false;
        setIsLoading(false);
      }
    },
    [anchors, apiKey, fonts, messages, model]
  );

  const handleReset = useCallback((): void => {
    setAnchors(DEFAULT_ANCHORS);
    setFonts(DEFAULT_FONTS);
    setFontRationale(undefined);
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
          <Box minWidth={240}>
            <SelectField
              helperText={apiKey ? undefined : "Add a key to load models"}
              onChange={handleModelChange}
              options={modelOptions}
              requireValue
              title="Model"
              value={resolvedModel}
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
              disabled={isLoading}
              onChangeAnchor={handleChangeAnchor}
              onSelectFamily={setSelectedFamily}
              selectedFamily={selectedFamily}
            />
          </Box>
          <Box border="default" gap={3} padding={4} rounding="md">
            <Heading size="sm">Fonts</Heading>
            <Text color="secondaryLight" size="sm">
              Pick a heading + body pairing (or let the assistant suggest one). The preview uses the
              real typefaces on web; the export includes the theme.font config.
            </Text>
            <FontControls
              disabled={isLoading}
              fonts={fonts}
              onChange={setFonts}
              rationale={fontRationale}
            />
          </Box>
        </Box>

        <Box flex="grow" gap={6}>
          <PaletteRamps primitives={primitives} />
          <ContrastReport results={lightContrast} title="Accessibility — light mode (WCAG)" />
          <ContrastReport results={darkContrast} title="Accessibility — dark mode (WCAG)" />
          <ComponentPreview primitives={primitives} />
          <DarkModeAudit />
          <CodeOutput fonts={fonts} primitives={primitives} />
        </Box>
      </Box>
    </Box>
  );
};
