import {Box, Slider, Text, TextField} from "@terreno/ui";
import React, {useCallback, useMemo, useState} from "react";

import {hexToHsl, hslToHex, normalizeHex, readableTextColor} from "./colorUtils";

/**
 * Cross-platform color picker: a live swatch, a hex text field ("type in colors"), and Hue /
 * Saturation / Lightness sliders. Works identically on web and native since it is built on the
 * Terreno `Slider` rather than a DOM `<input type="color">`.
 */

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  disabled?: boolean;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({value, onChange, label, disabled}) => {
  // Track raw hex text separately so partially-typed values don't get clobbered mid-edit.
  const [hexDraft, setHexDraft] = useState<string>(value);

  // Keep the draft in sync when the value changes from outside (LLM output, slider drag).
  React.useEffect(() => {
    setHexDraft(value);
  }, [value]);

  const hsl = useMemo(() => hexToHsl(value) ?? {h: 0, l: 0.5, s: 0}, [value]);
  const normalizedValue = normalizeHex(value) ?? "#000000";
  // The picker renders under the default (light) theme, where `inverted` is white and
  // `primary` is near-black — enough to label any swatch legibly.
  const swatchTextColor = readableTextColor(normalizedValue) === "#ffffff" ? "inverted" : "primary";

  const handleHexChange = useCallback(
    (next: string): void => {
      setHexDraft(next);
      const normalized = normalizeHex(next);
      if (normalized) {
        onChange(normalized);
      }
    },
    [onChange]
  );

  const handleHslChange = useCallback(
    (partial: Partial<{h: number; s: number; l: number}>): void => {
      onChange(hslToHex({...hsl, ...partial}));
    },
    [hsl, onChange]
  );

  return (
    <Box gap={2}>
      <Box
        alignItems="center"
        dangerouslySetInlineStyle={{__style: {backgroundColor: normalizedValue}}}
        height={48}
        justifyContent="center"
        rounding="md"
      >
        <Text bold color={swatchTextColor}>
          {label ? `${label} · ` : ""}
          {normalizedValue.toUpperCase()}
        </Text>
      </Box>
      <TextField
        disabled={disabled}
        onChange={handleHexChange}
        placeholder="#0086b3"
        title="Hex"
        value={hexDraft}
      />
      <Slider
        disabled={disabled}
        inlineLabels
        labels={{min: "Hue"}}
        maximumValue={360}
        minimumValue={0}
        onChange={(next) => handleHslChange({h: next})}
        showSelection
        step={1}
        value={hsl.h}
      />
      <Slider
        disabled={disabled}
        inlineLabels
        labels={{min: "Sat"}}
        maximumValue={100}
        minimumValue={0}
        onChange={(next) => handleHslChange({s: next / 100})}
        showSelection
        step={1}
        value={Math.round(hsl.s * 100)}
      />
      <Slider
        disabled={disabled}
        inlineLabels
        labels={{min: "Light"}}
        maximumValue={100}
        minimumValue={0}
        onChange={(next) => handleHslChange({l: next / 100})}
        showSelection
        step={1}
        value={Math.round(hsl.l * 100)}
      />
    </Box>
  );
};
