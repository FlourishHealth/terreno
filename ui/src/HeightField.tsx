import React, {type FC, useCallback, useEffect, useRef, useState} from "react";
import {Pressable, TextInput, View} from "react-native";

import {Box} from "./Box";
import type {HeightFieldProps} from "./Common";
import {FieldError, FieldHelperText, FieldTitle} from "./fieldElements";
import {HeightActionSheet} from "./HeightActionSheet";
import {isMobileDevice} from "./MediaQuery";
import {Text} from "./Text";
import {useTheme} from "./Theme";
import {isNative} from "./Utilities";

const inchesToFeetAndInches = (totalInches: string | undefined): {feet: string; inches: string} => {
  if (!totalInches) {
    return {feet: "", inches: ""};
  }
  const total = parseInt(totalInches, 10);
  if (Number.isNaN(total)) {
    return {feet: "", inches: ""};
  }
  const feet = Math.floor(total / 12);
  const inches = total % 12;
  return {feet: String(feet), inches: String(inches)};
};

const feetAndInchesToInches = (feet: string, inches: string): string => {
  const feetNum = parseInt(feet, 10) || 0;
  const inchesNum = parseInt(inches, 10) || 0;
  return String(feetNum * 12 + inchesNum);
};

const formatHeightDisplay = (totalInches: string | undefined): string => {
  if (!totalInches) {
    return "";
  }
  const {feet, inches} = inchesToFeetAndInches(totalInches);
  if (!feet && !inches) {
    return "";
  }
  return `${feet}ft ${inches}in`;
};

interface HeightSegmentProps {
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder: string;
  label: string;
  disabled?: boolean;
  maxValue: number;
  inputRef?: (ref: TextInput | null) => void;
  error?: boolean;
}

const HeightSegment: FC<HeightSegmentProps> = ({
  value,
  onChange,
  onBlur,
  placeholder,
  label,
  disabled,
  maxValue,
  inputRef,
  error,
}) => {
  const {theme} = useTheme();

  const handleChange = useCallback(
    (text: string) => {
      const numericValue = text.replace(/[^0-9]/g, "");
      if (numericValue === "") {
        onChange("");
        return;
      }
      const num = parseInt(numericValue, 10);
      if (num <= maxValue) {
        onChange(numericValue);
      }
    },
    [onChange, maxValue]
  );

  return (
    <View style={{alignItems: "center", flexDirection: "row", gap: 4}}>
      <View
        style={{
          alignItems: "center",
          backgroundColor: disabled ? theme.surface.neutralLight : theme.surface.base,
          borderColor: error ? theme.border.error : theme.border.dark,
          borderRadius: 4,
          borderWidth: 1,
          flexDirection: "row",
          height: 40,
          justifyContent: "center",
          paddingHorizontal: 8,
          width: 50,
        }}
      >
        <TextInput
          accessibilityHint={`Enter ${label}`}
          aria-label={`${label} input`}
          inputMode="numeric"
          onBlur={onBlur}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={theme.text.secondaryLight}
          readOnly={disabled}
          ref={inputRef}
          selectTextOnFocus
          style={{
            color: error ? theme.text.error : theme.text.primary,
            fontFamily: "text",
            fontSize: 16,
            textAlign: "center",
            width: "100%",
          }}
          value={value}
        />
      </View>
      <Text>{label}</Text>
    </View>
  );
};

export const HeightField: FC<HeightFieldProps> = ({
  title,
  disabled,
  helperText,
  errorText,
  value,
  onChange,
  testID,
}) => {
  const {theme} = useTheme();
  const actionSheetRef: React.RefObject<any> = useRef(null);
  const isMobileOrNative = isMobileDevice() || isNative();

  const {feet: initialFeet, inches: initialInches} = inchesToFeetAndInches(value);
  const [feet, setFeet] = useState(initialFeet);
  const [inches, setInches] = useState(initialInches);

  useEffect(() => {
    const {feet: newFeet, inches: newInches} = inchesToFeetAndInches(value);
    setFeet(newFeet);
    setInches(newInches);
  }, [value]);

  const handleFeetChange = useCallback(
    (newFeet: string) => {
      setFeet(newFeet);
      if (newFeet || inches) {
        const totalInches = feetAndInchesToInches(newFeet, inches);
        onChange(totalInches);
      } else {
        onChange("");
      }
    },
    [inches, onChange]
  );

  const handleInchesChange = useCallback(
    (newInches: string) => {
      setInches(newInches);
      if (feet || newInches) {
        const totalInches = feetAndInchesToInches(feet, newInches);
        onChange(totalInches);
      } else {
        onChange("");
      }
    },
    [feet, onChange]
  );

  const handleBlur = useCallback(() => {
    if (feet || inches) {
      const totalInches = feetAndInchesToInches(feet, inches);
      onChange(totalInches);
    }
  }, [feet, inches, onChange]);

  const handleActionSheetChange = useCallback(
    (newValue: string) => {
      onChange(newValue);
    },
    [onChange]
  );

  const openActionSheet = useCallback(() => {
    if (disabled) {
      return;
    }
    actionSheetRef.current?.setModalVisible(true);
  }, [disabled]);

  let borderColor = theme.border.dark;
  if (disabled) {
    borderColor = theme.border.activeNeutral;
  } else if (errorText) {
    borderColor = theme.border.error;
  }

  if (isMobileOrNative) {
    return (
      <View style={{flexDirection: "column", width: "100%"}} testID={testID}>
        {Boolean(title) && <FieldTitle text={title!} />}
        {Boolean(errorText) && <FieldError text={errorText!} />}
        <Pressable
          accessibilityHint="Tap to select height"
          accessibilityLabel="Height selector"
          aria-role="button"
          disabled={disabled}
          onPress={openActionSheet}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor: disabled ? theme.surface.neutralLight : theme.surface.base,
              borderColor,
              borderRadius: 4,
              borderWidth: 1,
              flexDirection: "row",
              minHeight: 40,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text color={value ? "primary" : "secondaryLight"}>
              {value ? formatHeightDisplay(value) : "Select height"}
            </Text>
          </View>
        </Pressable>
        {Boolean(helperText) && <FieldHelperText text={helperText!} />}
        <HeightActionSheet
          actionSheetRef={actionSheetRef}
          onChange={handleActionSheetChange}
          value={value || "60"}
        />
      </View>
    );
  }

  return (
    <View style={{flexDirection: "column", width: "100%"}} testID={testID}>
      {Boolean(title) && <FieldTitle text={title!} />}
      {Boolean(errorText) && <FieldError text={errorText!} />}
      <Box direction="row" gap={4}>
        <HeightSegment
          disabled={disabled}
          error={Boolean(errorText)}
          label="ft"
          maxValue={7}
          onBlur={handleBlur}
          onChange={handleFeetChange}
          placeholder="0"
          value={feet}
        />
        <HeightSegment
          disabled={disabled}
          error={Boolean(errorText)}
          label="in"
          maxValue={11}
          onBlur={handleBlur}
          onChange={handleInchesChange}
          placeholder="0"
          value={inches}
        />
      </Box>
      {Boolean(helperText) && <FieldHelperText text={helperText!} />}
    </View>
  );
};
