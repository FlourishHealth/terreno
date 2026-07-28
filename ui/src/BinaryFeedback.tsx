import {type FC, useCallback} from "react";
import {Pressable} from "react-native";

import {Box} from "./Box";
import type {BinaryFeedbackProps, BinaryFeedbackValue, IconSize} from "./Common";
import {Icon} from "./Icon";

const ICON_SIZE_MAP: {[key in "sm" | "md" | "lg"]: IconSize} = {
  lg: "xl",
  md: "lg",
  sm: "md",
};

const TAP_TARGET_MAP: {[key in "sm" | "md" | "lg"]: number} = {
  lg: 40,
  md: 32,
  sm: 24,
};

/**
 * A pair of thumbs up / thumbs down options for collecting binary feedback, e.g. on an AI
 * generated response. The selected option is filled in; pressing it again clears the selection
 * and calls `onChange` with undefined.
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
    const color: "secondaryDark" | "secondaryLight" =
      isSelected && !disabled ? "secondaryDark" : "secondaryLight";

    return (
      <Pressable
        accessibilityLabel={isPositive ? positiveAccessibilityLabel : negativeAccessibilityLabel}
        accessibilityRole="button"
        accessibilityState={{disabled, selected: isSelected}}
        disabled={disabled}
        onPress={async () => handlePress(optionValue)}
        style={{
          alignItems: "center",
          height: tapTargetSize,
          justifyContent: "center",
          width: tapTargetSize,
        }}
        testID={testID ? `${testID}-${isPositive ? "positive" : "negative"}` : undefined}
      >
        <Icon
          color={color}
          iconName={isPositive ? "thumbs-up" : "thumbs-down"}
          size={iconSize}
          type={isSelected ? "solid" : "regular"}
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
