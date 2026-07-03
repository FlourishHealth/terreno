import {Box, Text} from "@terreno/ui";
import React, {useCallback} from "react";
import {ColorPicker} from "./ColorPicker";
import type {PaletteAnchors} from "./colorUtils";
import {normalizeHex, readableTextColor} from "./colorUtils";
import {ANCHOR_FAMILIES, FAMILY_LABELS, type MainFamily, type StatusFamily} from "./paletteTypes";

/**
 * The manual editing surface: a swatch per anchor family that you tap to select, plus the full
 * Hue/Saturation/Lightness + hex picker for whichever family is selected. Editing an anchor here
 * regenerates the whole palette, exactly like a change coming from the chat assistant.
 */

type Family = MainFamily | StatusFamily;

interface AnchorSwatchProps {
  family: Family;
  hex: string;
  selected: boolean;
  onSelect: (family: Family) => void;
}

const AnchorSwatch: React.FC<AnchorSwatchProps> = ({family, hex, selected, onSelect}) => {
  const normalized = normalizeHex(hex) ?? "#000000";
  const textColor = readableTextColor(normalized) === "#ffffff" ? "inverted" : "primary";
  const handlePress = useCallback((): void => {
    onSelect(family);
  }, [family, onSelect]);

  return (
    <Box
      accessibilityHint={`Edit the ${FAMILY_LABELS[family]} anchor color`}
      accessibilityLabel={`${FAMILY_LABELS[family]} anchor`}
      alignItems="center"
      border={selected ? "activeAccent" : "default"}
      dangerouslySetInlineStyle={{__style: {backgroundColor: normalized}}}
      gap={1}
      justifyContent="center"
      onClick={handlePress}
      padding={2}
      rounding="md"
      width={104}
    >
      <Text bold color={textColor} size="sm">
        {FAMILY_LABELS[family]}
      </Text>
      <Text color={textColor} size="sm">
        {normalized.toUpperCase()}
      </Text>
    </Box>
  );
};

interface AnchorControlsProps {
  anchors: PaletteAnchors;
  selectedFamily: Family;
  onSelectFamily: (family: Family) => void;
  onChangeAnchor: (family: Family, hex: string) => void;
}

export const AnchorControls: React.FC<AnchorControlsProps> = ({
  anchors,
  selectedFamily,
  onSelectFamily,
  onChangeAnchor,
}) => {
  const handleColorChange = useCallback(
    (hex: string): void => {
      onChangeAnchor(selectedFamily, hex);
    },
    [onChangeAnchor, selectedFamily]
  );

  return (
    <Box gap={4}>
      <Box direction="row" gap={2} wrap>
        {ANCHOR_FAMILIES.map((family) => (
          <AnchorSwatch
            family={family}
            hex={anchors[family]}
            key={family}
            onSelect={onSelectFamily}
            selected={family === selectedFamily}
          />
        ))}
      </Box>
      <ColorPicker
        label={FAMILY_LABELS[selectedFamily]}
        onChange={handleColorChange}
        value={anchors[selectedFamily]}
      />
    </Box>
  );
};
