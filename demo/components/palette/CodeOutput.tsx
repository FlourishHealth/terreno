import {Box, Button, Heading, SegmentedControl, Text} from "@terreno/ui";
import * as Clipboard from "expo-clipboard";
import React, {useCallback, useMemo, useState} from "react";
import {Platform, Text as RNText, ScrollView} from "react-native";

import {buildFontConfigCode, buildPrimitivesObjectCode, buildSetPrimitivesCode} from "./codeExport";
import type {FontSelection} from "./fonts";

/**
 * Emits the exact, copy-pasteable code for the generated palette: a `ThemePrimitives` object
 * literal for a theme file, a runtime `setPrimitives({...})` call, and the recommended `theme.font`
 * config. This is the "output the exact code" deliverable — what a developer drops into their
 * Terreno app to adopt the palette.
 */

interface CodeOutputProps {
  primitives: Record<string, string>;
  fonts: FontSelection;
}

const MONOSPACE = Platform.select({default: "monospace", ios: "Menlo", web: "monospace"});

export const CodeOutput: React.FC<CodeOutputProps> = ({primitives, fonts}) => {
  const [form, setForm] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);

  const code = useMemo(() => {
    if (form === 1) {
      return buildSetPrimitivesCode(primitives);
    }
    if (form === 2) {
      return buildFontConfigCode(fonts);
    }
    return buildPrimitivesObjectCode(primitives);
  }, [fonts, form, primitives]);

  const handleCopy = useCallback(async (): Promise<void> => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  const handleFormChange = useCallback((index: number): void => {
    setForm(index);
  }, []);

  return (
    <Box gap={3}>
      <Box alignItems="center" direction="row" gap={3} justifyContent="between" wrap>
        <Heading size="sm">Export code</Heading>
        <Button
          iconName="copy"
          onClick={handleCopy}
          text={copied ? "Copied!" : "Copy"}
          variant="outline"
        />
      </Box>
      <SegmentedControl
        items={["Theme primitives", "setPrimitives()", "Fonts"]}
        onChange={handleFormChange}
        selectedIndex={form}
      />
      <Box color="neutralDark" padding={3} rounding="md">
        <ScrollView horizontal showsHorizontalScrollIndicator style={{maxHeight: 320}}>
          <ScrollView showsVerticalScrollIndicator>
            <RNText style={{color: "#f2f2f2", fontFamily: MONOSPACE, fontSize: 12, lineHeight: 18}}>
              {code}
            </RNText>
          </ScrollView>
        </ScrollView>
      </Box>
      <Text color="secondaryLight" size="sm">
        Paste the primitives into your theme, or call setPrimitives() from a component to preview it
        live.
      </Text>
    </Box>
  );
};
