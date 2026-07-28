import Feather from "@expo/vector-icons/Feather";
import {type FC, useCallback} from "react";
import {Pressable} from "react-native";

import {Box} from "./Box";
import type {BinaryFeedbackProps, BinaryFeedbackValue} from "./Common";
import {useTheme} from "./Theme";

const ICON_SIZE_MAP: {[key in "sm" | "md" | "lg"]: number} = {
  lg: 24,
  md: 20,
  sm: 16,
};

const TAP_TARGET_MAP: {[key in "sm" | "md" | "lg"]: number} = {
  lg: 40,
  md: 32,
  sm: 24,
};

/**
 * A pair of thumbs up / thumbs down options for collecting binary feedback, e.g. on an AI
 * generated response. The selected option is darkened and sits on a filled surface; pressing it
 * again clears the selection and calls `onChange` with undefined.
 */
export const BinaryFeedback: FC<BinaryFeedbackProps> = ({
  disabled = false,
  negativeAccessibilityLabel = "Thumbs down",
  onChange,
  positiveAccessibilityLabel = "Thumbs up",
  size = "md",
  testID,
  value,
}) => {
  const {theme} = useTheme();

  const handlePress = useCallback(
    async (pressedValue: BinaryFeedbackValue) => {
      if (disabled) {
        return;
      }
      await onChange(value === pressedValue ? undefined : pressedValue);
    },
    [disabled, onChange, value]
  );

  const iconSize = ICON_SIZE_MAP[size];
  const tapTargetSize = TAP_TARGET_MAP[size];

  const renderOption = (optionValue: BinaryFeedbackValue) => {
    const isSelected = value === optionValue;
    const isPositive = optionValue === "positive";
    const iconColor =
      isSelected && !disabled ? theme.text.secondaryDark : theme.text.secondaryLight;
    let backgroundColor = "transparent";
    if (isSelected) {
      backgroundColor = disabled ? theme.surface.disabled : theme.surface.secondaryLight;
    }

    return (
      <Pressable
        accessibilityLabel={isPositive ? positiveAccessibilityLabel : negativeAccessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{disabled, selected: isSelected}}
        disabled={disabled}
        onPress={async () => handlePress(optionValue)}
        style={{
          alignItems: "center",
          backgroundColor,
          borderRadius: tapTargetSize / 2,
          height: tapTargetSize,
          justifyContent: "center",
          width: tapTargetSize,
        }}
        testID={testID ? `${testID}-${isPositive ? "positive" : "negative"}` : undefined}
      >
        <Feather
          color={iconColor}
          name={isPositive ? "thumbs-up" : "thumbs-down"}
          selectable={undefined}
          size={iconSize}
        />
      </Pressable>
    );
  };

  return (
    <Box alignItems="center" direction="row" gap={1} testID={testID}>
      {renderOption("positive")}
      {renderOption("negative")}
    </Box>
  );
};
