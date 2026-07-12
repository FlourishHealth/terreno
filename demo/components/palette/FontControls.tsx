import {Box, SelectField, Text} from "@terreno/ui";
import React, {useCallback, useEffect, useMemo} from "react";
import {Text as RNText} from "react-native";

import {
  BODY_FONTS,
  buildFontOptions,
  FONT_PAIRINGS,
  type FontSelection,
  HEADING_FONTS,
} from "./fonts";
import {loadWebFonts} from "./webFonts";

/**
 * Font selection + live preview. The heading and body families can be chosen manually (or suggested
 * by the assistant), and are rendered in the real typeface via a web font loader. `theme.font` in
 * the stock Terreno theme currently hardcodes Nunito/Titillium, so this drives the export and the
 * preview here rather than re-theming every library component.
 */

interface FontControlsProps {
  fonts: FontSelection;
  onChange: (fonts: FontSelection) => void;
  rationale?: string;
  disabled?: boolean;
}

const PairingButton: React.FC<{
  name: string;
  fonts: FontSelection;
  active: boolean;
  disabled?: boolean;
  onSelect: (fonts: FontSelection) => void;
}> = ({name, fonts, active, disabled, onSelect}) => {
  const handlePress = useCallback((): void => {
    if (disabled) {
      return;
    }
    onSelect(fonts);
  }, [disabled, fonts, onSelect]);
  return (
    <Box
      accessibilityHint={`Use the ${name} font pairing`}
      accessibilityLabel={name}
      border={active ? "activeAccent" : "default"}
      dangerouslySetInlineStyle={{__style: {opacity: disabled ? 0.6 : 1}}}
      onClick={handlePress}
      paddingX={3}
      paddingY={2}
      rounding="md"
    >
      <Text size="sm">{name}</Text>
    </Box>
  );
};

export const FontControls: React.FC<FontControlsProps> = ({
  fonts,
  onChange,
  rationale,
  disabled,
}) => {
  const headingOptions = useMemo(
    () => buildFontOptions(HEADING_FONTS, fonts.headingFont),
    [fonts.headingFont]
  );
  const bodyOptions = useMemo(() => buildFontOptions(BODY_FONTS, fonts.bodyFont), [fonts.bodyFont]);

  // Load the selected families on web so the preview renders in the real typeface.
  useEffect(() => {
    loadWebFonts([fonts.headingFont, fonts.bodyFont]);
  }, [fonts.headingFont, fonts.bodyFont]);

  const handleHeading = useCallback(
    (value: string): void => {
      onChange({...fonts, headingFont: value});
    },
    [fonts, onChange]
  );

  const handleBody = useCallback(
    (value: string): void => {
      onChange({...fonts, bodyFont: value});
    },
    [fonts, onChange]
  );

  return (
    <Box gap={4}>
      <Box direction="column" gap={3} mdDirection="row">
        <Box flex="grow">
          <SelectField
            disabled={disabled}
            onChange={handleHeading}
            options={headingOptions}
            requireValue
            title="Heading font"
            value={fonts.headingFont}
          />
        </Box>
        <Box flex="grow">
          <SelectField
            disabled={disabled}
            onChange={handleBody}
            options={bodyOptions}
            requireValue
            title="Body font"
            value={fonts.bodyFont}
          />
        </Box>
      </Box>

      <Box direction="row" gap={2} wrap>
        {FONT_PAIRINGS.map((pairing) => (
          <PairingButton
            active={
              pairing.fonts.headingFont === fonts.headingFont &&
              pairing.fonts.bodyFont === fonts.bodyFont
            }
            disabled={disabled}
            fonts={pairing.fonts}
            key={pairing.name}
            name={pairing.name}
            onSelect={onChange}
          />
        ))}
      </Box>

      {Boolean(rationale) && (
        <Text color="secondaryLight" size="sm">
          {rationale}
        </Text>
      )}

      <Box border="default" gap={2} padding={4} rounding="md">
        {/* Rendered with raw RN Text so the exact chosen family applies (loaded on web above). */}
        <RNText style={{fontFamily: fonts.headingFont, fontSize: 26, fontWeight: "700"}}>
          {fonts.headingFont}
        </RNText>
        <RNText style={{fontFamily: fonts.bodyFont, fontSize: 15, lineHeight: 22}}>
          The quick brown fox jumps over the lazy dog. Body copy in {fonts.bodyFont} — 0123456789.
        </RNText>
        <RNText style={{color: "#888", fontFamily: fonts.bodyFont, fontSize: 12}}>
          Heading: {fonts.headingFont} · Body: {fonts.bodyFont}
        </RNText>
      </Box>
    </Box>
  );
};
