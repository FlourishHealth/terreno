import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {type FC, useCallback} from "react";
import {Pressable} from "react-native";

import {Box} from "./Box";
import type {BinaryFeedbackProps, BinaryFeedbackValue} from "./Common";
import {useTheme} from "./Theme";

const ICON_SIZE_MAP: {[key in "sm" | "md" | "lg"]: number} = {
  lg: 20,
  md: 16,
  sm: 12,
};

const ICON_NAME_MAP = {
  negative: {selected: "thumb-down-alt", unselected: "thumb-down-off-alt"},
  positive: {selected: "thumb-up-alt", unselected: "thumb-up-off-alt"},
} as const;

const TAP_TARGET_MAP: {[key in "sm" | "md" | "lg"]: number} = {
  lg: 28,
  md: 24,
  sm: 20,
};

/**
 * react-native-web only activates a Pressable on the spacebar when the element is a native button or
 * has role="button", so a checkbox needs its own spacebar handler (per ARIA, spacebar is the
 * activation key for a checkbox). Not typed by react-native, so it is spread in separately.
 */
interface WebKeyDownProps {
  onKeyDown?: (event: {key: string; preventDefault: () => void}) => void;
}

/**
 * A pair of thumbs up / thumbs down options for collecting binary feedback, e.g. on an AI
 * generated response. The selected option switches from an outlined to a filled thumb; pressing it
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

  const handleKeyDown = useCallback(
    async (optionValue: BinaryFeedbackValue, event: {key: string; preventDefault: () => void}) => {
      if (event.key !== " " && event.key !== "Spacebar") {
        return;
      }
      event.preventDefault();
      await handlePress(optionValue);
    },
    [handlePress]
  );

  const iconSize = ICON_SIZE_MAP[size];
  const tapTargetSize = TAP_TARGET_MAP[size];

  const renderOption = (optionValue: BinaryFeedbackValue) => {
    const isSelected = value === optionValue;
    const isPositive = optionValue === "positive";
    const iconColor = disabled ? theme.surface.disabled : theme.surface.secondaryDark;
    const iconName =
      ICON_NAME_MAP[isPositive ? "positive" : "negative"][isSelected ? "selected" : "unselected"];
    const webKeyDownProps: WebKeyDownProps = {
      onKeyDown: async (event) => handleKeyDown(optionValue, event),
    };

    return (
      <Pressable
        {...webKeyDownProps}
        accessibilityLabel={isPositive ? positiveAccessibilityLabel : negativeAccessibilityLabel}
        accessibilityRole="checkbox"
        accessibilityState={{checked: isSelected, disabled, selected: isSelected}}
        aria-checked={isSelected}
        aria-disabled={disabled}
        disabled={disabled}
        onPress={async () => handlePress(optionValue)}
        style={{
          alignItems: "center",
          backgroundColor: "transparent",
          borderRadius: tapTargetSize / 2,
          height: tapTargetSize,
          justifyContent: "center",
          width: tapTargetSize,
        }}
        testID={testID ? `${testID}-${isPositive ? "positive" : "negative"}` : undefined}
      >
        <MaterialIcons color={iconColor} name={iconName} selectable={undefined} size={iconSize} />
      </Pressable>
    );
  };

  return (
    <Box alignItems="center" direction="row" gap={2} testID={testID}>
      {renderOption("positive")}
      {renderOption("negative")}
    </Box>
  );
};
