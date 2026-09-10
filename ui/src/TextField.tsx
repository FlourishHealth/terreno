import {getCalendars} from "expo-localization";
import {type FC, useEffect, useMemo, useRef, useState} from "react";
import {
  type DimensionValue,
  type KeyboardTypeOptions,
  Platform,
  Pressable,
  type StyleProp,
  TextInput,
  View,
} from "react-native";

import {AiSuggestionBox} from "./AiSuggestionBox";
import {
  agentTextFieldLog,
  installAgentTextFieldLogDumper,
  isAdminFieldTestId,
} from "./agentFieldDebug";
import type {TextFieldProps, TextStyleWithOutline} from "./Common";
import {FieldError} from "./fieldElements/FieldError";
import {FieldHelperText} from "./fieldElements/FieldHelperText";
import {FieldTitle} from "./fieldElements/FieldTitle";
import {Icon} from "./Icon";
import {useTheme} from "./Theme";
import {resolveFieldTestIDsFromProps} from "./testing/resolveTestId";

installAgentTextFieldLogDumper();

const keyboardMap: {[id: string]: string | undefined} = {
  date: "default",
  decimal: "decimal-pad",
  decimalRange: "decimal-pad",
  email: "email-address",
  height: "default",
  number: "number-pad",
  numberRange: "number-pad",
  password: "default",
  phoneNumber: "number-pad",
  search: "default",
  text: "default",
  url: Platform.select({
    android: "default",
    ios: "url",
  }),
  username: "default",
};

// Not an exhaustive list of all the textContent types, but the ones we use.
const textContentMap: {
  [id: string]: "none" | "emailAddress" | "password" | "username" | "URL" | undefined;
} = {
  date: "none",
  decimal: "none",
  decimalRange: "none",
  email: "emailAddress",
  height: "none",
  number: "none",
  password: "password",
  search: "none",
  text: "none",
  url: Platform.select({
    android: "none",
    ios: "URL",
  }),
  username: "username",
};

export const TextField: FC<TextFieldProps> = ({
  title,
  disabled,
  helperText,
  errorText,
  value,
  onChange,
  placeholder,
  blurOnSubmit = true,
  iconName,
  onIconClick,
  trimOnBlur = true,
  type = "text",
  autoComplete,
  inputRef,
  multiline,
  rows = 1,
  grow,
  returnKeyType,
  onBlur,
  onFocus,
  onEnter,
  onSubmitEditing,
  testID,
  testIDs,
  id,
  aiSuggestion,
}) => {
  const {theme} = useTheme();
  const fieldTestIDs = resolveFieldTestIDsFromProps({testID, testIDs});

  const calendar = getCalendars()[0];
  const localTimeZone = calendar?.timeZone;
  if (!localTimeZone) {
    console.warn("Could not automatically determine timezone.");
  }

  const [focused, setFocused] = useState(false);
  const [height, setHeight] = useState(rows * 40);
  const renderCountRef = useRef(0);
  const mountGenerationRef = useRef(Math.random().toString(36).slice(2, 10));
  const prevOnChangeRef = useRef(onChange);
  const prevValueRef = useRef(value);
  const isAdminField = isAdminFieldTestId(fieldTestIDs.input);

  renderCountRef.current += 1;
  if (isAdminField) {
    const onChangeChanged = prevOnChangeRef.current !== onChange;
    const valueChanged = prevValueRef.current !== value;
    if (onChangeChanged || valueChanged || renderCountRef.current <= 3) {
      agentTextFieldLog("render", "H3", {
        mountGeneration: mountGenerationRef.current,
        onChangeChanged,
        renderCount: renderCountRef.current,
        testID: fieldTestIDs.input,
        valueChanged,
        valuePreview: typeof value === "string" ? value.slice(0, 120) : value,
      });
    }
    prevOnChangeRef.current = onChange;
    prevValueRef.current = value;
  }

  useEffect(() => {
    if (!isAdminField) {
      return;
    }
    agentTextFieldLog("mount", "H4", {
      mountGeneration: mountGenerationRef.current,
      testID: fieldTestIDs.input,
    });
    return () => {
      agentTextFieldLog("unmount", "H4", {
        mountGeneration: mountGenerationRef.current,
        renderCount: renderCountRef.current,
        testID: fieldTestIDs.input,
      });
    };
  }, [fieldTestIDs.input, isAdminField]);

  let borderColor = focused ? theme.border.focus : theme.border.dark;
  if (disabled) {
    borderColor = theme.border.activeNeutral;
  } else if (errorText) {
    borderColor = theme.border.error;
  }

  const calculatedHeight: DimensionValue = useMemo(() => {
    if (grow) {
      return Math.max(40, height);
    } else if (multiline) {
      return height || "100%";
    } else {
      // iOS clips placeholder glyphs (descenders, cap height) when the box is ~fontSize tall;
      // single-line inputs need extra vertical room beyond 16px text.
      return Platform.OS === "ios" ? 24 : 22;
    }
  }, [grow, height, multiline]);

  const defaultTextInputStyles = useMemo(() => {
    const style: StyleProp<TextStyleWithOutline> = {
      color: theme.text.primary,
      flex: 1,
      fontFamily: "text",
      fontSize: 16,
      gap: 10,
      height: calculatedHeight,
      paddingVertical: 0,
      width: "100%",
    };

    if (Platform.OS === "web") {
      style.outline = "none";
    }
    return style;
  }, [calculatedHeight, theme.text.primary]);

  if (["numberRange", "decimalRange", "height"].includes(type)) {
    console.warn(`${type} is not yet supported`);
  }

  const shouldAutocorrect =
    ["text", "textarea"].includes(type) && (!autoComplete || autoComplete === "on");

  const keyboardType = keyboardMap[type];
  const textContentType = textContentMap[type || "text"];

  return (
    <View
      style={{
        flexDirection: "column",
        width: "100%",
      }}
    >
      {Boolean(title) && <FieldTitle testID={fieldTestIDs.label} text={title!} />}
      {Boolean(errorText) && <FieldError testID={fieldTestIDs.error} text={errorText!} />}
      <View
        style={{
          backgroundColor: disabled ? theme.surface.neutralLight : theme.surface.base,
          borderColor,
          borderRadius: 4,
          borderWidth: focused ? 3 : 1,
          flexDirection: "column",
          gap: aiSuggestion ? 10 : 0,
          overflow: "hidden",
          paddingHorizontal: focused ? 10 : 12,
          paddingVertical: focused ? 6 : 8,
        }}
      >
        {Boolean(aiSuggestion) && (
          <AiSuggestionBox
            testID={fieldTestIDs.input ? `${fieldTestIDs.input}-ai-suggestion` : undefined}
            {...aiSuggestion!}
          />
        )}
        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
          }}
        >
          <TextInput
            accessibilityHint="Enter text here"
            accessibilityState={{disabled}}
            aria-label="Text input field"
            autoCapitalize={type === "text" ? "sentences" : "none"}
            autoCorrect={shouldAutocorrect}
            blurOnSubmit={blurOnSubmit}
            enterKeyHint={returnKeyType}
            keyboardType={keyboardType as KeyboardTypeOptions}
            multiline={multiline}
            nativeID={id}
            numberOfLines={rows || 4}
            onBlur={() => {
              if (disabled) {
                return;
              }
              let finalValue = value ?? "";

              if (trimOnBlur && value) {
                finalValue = finalValue.trim();
                if (finalValue !== value) {
                  if (isAdminField) {
                    agentTextFieldLog("onBlur trim onChange", "H3", {
                      finalValuePreview: finalValue.slice(0, 120),
                      testID: fieldTestIDs.input,
                      valuePreview: value.slice(0, 120),
                    });
                  }
                  onChange(finalValue);
                }
              }
              if (onBlur) {
                onBlur(finalValue);
              }
              if (isAdminField) {
                agentTextFieldLog("onBlur", "H3", {
                  finalValuePreview: finalValue.slice(0, 120),
                  testID: fieldTestIDs.input,
                });
              }
              setFocused(false);
            }}
            onChangeText={(text) => {
              if (isAdminField) {
                agentTextFieldLog("onChangeText", "H3", {
                  focused,
                  grow: Boolean(grow),
                  testID: fieldTestIDs.input,
                  textPreview: text.slice(0, 120),
                });
              }
              onChange(text);
            }}
            onContentSizeChange={(event) => {
              if (!grow) {
                return;
              }
              const nextHeight = event.nativeEvent.contentSize.height;
              if (isAdminField) {
                agentTextFieldLog("onContentSizeChange", "H3", {
                  nextHeight,
                  prevHeight: height,
                  testID: fieldTestIDs.input,
                });
              }
              setHeight(nextHeight);
            }}
            onFocus={() => {
              if (!disabled) {
                setFocused(true);
              }
              if (isAdminField) {
                agentTextFieldLog("onFocus", "H3", {
                  testID: fieldTestIDs.input,
                  valuePreview: typeof value === "string" ? value.slice(0, 120) : value,
                });
              }
              if (onFocus) {
                onFocus();
              }
            }}
            onSubmitEditing={() => {
              if (onEnter) {
                onEnter();
              }
              if (onSubmitEditing) {
                onSubmitEditing();
              }
            }}
            placeholder={placeholder}
            placeholderTextColor={theme.text.secondaryLight}
            readOnly={disabled}
            ref={(ref) => {
              if (inputRef) {
                inputRef(ref);
              }
            }}
            secureTextEntry={type === "password"}
            style={defaultTextInputStyles}
            testID={fieldTestIDs.input}
            textContentType={textContentType}
            underlineColorAndroid="transparent"
            value={value}
          />
          {Boolean(iconName) && (
            <Pressable aria-role="button" onPress={onIconClick}>
              <Icon iconName={iconName!} size="md" />
            </Pressable>
          )}
        </View>
      </View>
      {Boolean(helperText) && <FieldHelperText testID={fieldTestIDs.helper} text={helperText!} />}
      {/* {type === "numberRange" && value && (
        <NumberPickerActionSheet
          actionSheetRef={numberRangeActionSheetRef}
          max={max || (min || 0) + 100}
          min={min || 0}
          value={value}
          onChange={(result) => onChange(result)}
        />
      )}
      {type === "decimalRange" && value && (
        <DecimalRangeActionSheet
          actionSheetRef={decimalRangeActionSheetRef}
          max={max || (min || 0) + 100}
          min={min || 0}
          value={value}
          onChange={(result) => onChange(result)}
        />
      )} */}
      {/* {type === "height" && (
        <HeightActionSheet
          actionSheetRef={weightActionSheetRef}
          value={value}
          onChange={(result) => {
            onChange(result);
          }}
        />
      )} */}
    </View>
  );
};
