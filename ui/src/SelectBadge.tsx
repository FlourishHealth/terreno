import {Picker} from "@react-native-picker/picker";
import type React from "react";
import {useCallback, useMemo, useState} from "react";
import {Modal, Platform, Text, TouchableOpacity, View} from "react-native";

import type {FieldOption, SelectBadgeProps, SurfaceTheme, TextTheme} from "./Common";
import {Icon} from "./Icon";
import {useTheme} from "./Theme";
import {useWebDropdownAnchor, WebDropdownMenu, type WebDropdownMenuOption} from "./WebDropdownMenu";

export const SelectBadge = ({
  value,
  status = "info",
  secondary = false,
  customBackgroundColor,
  customTextColor,
  customBorderColor,
  disabled = false,
  options,
  onChange,
}: SelectBadgeProps): React.ReactElement => {
  const {theme} = useTheme();
  const [showPicker, setShowPicker] = useState(false);
  // Temporary state to manage value changes for ios picker
  // Assures the badge display value persists when user scrolls through options
  const [iosDisplayValue, setIosDisplayValue] = useState<string | undefined>(value);

  // Web-only: anchor the custom dropdown menu to the trigger element so that
  // Safari/Firefox/Chrome all render the same styled menu instead of the
  // browser's native <select> UI.
  const {
    anchor: webAnchor,
    measure: measureWebAnchor,
    triggerRef: webTriggerRef,
  } = useWebDropdownAnchor();

  const secondaryBorderColors = {
    custom: "#AAAAAA",
    error: "#F39E9E",
    info: "#8FC1D2",
    neutral: "#AAAAAA",
    success: "#7FD898",
    warning: "#FCC58F",
  };

  let borderWidth = 0;
  if (secondary || status === "custom") borderWidth = 1;

  let badgeColor: keyof TextTheme = "inverted";

  if (secondary) {
    if (status === "error") badgeColor = "error";
    else if (status === "warning") badgeColor = "warning";
    else if (status === "info") badgeColor = "secondaryDark";
    else if (status === "success") badgeColor = "success";
    else if (status === "neutral") badgeColor = "primary";
  }

  let badgeBgColor: keyof SurfaceTheme = "neutralDark";

  if (status === "error") badgeBgColor = secondary ? "errorLight" : "error";
  else if (status === "warning") badgeBgColor = secondary ? "warningLight" : "warning";
  else if (status === "info") badgeBgColor = secondary ? "secondaryLight" : "secondaryDark";
  else if (status === "success") badgeBgColor = secondary ? "successLight" : "success";
  else if (status === "neutral") badgeBgColor = secondary ? "neutralLight" : "neutralDark";

  const backgroundColor = status === "custom" ? customBackgroundColor : theme.surface[badgeBgColor];
  const borderColor = status === "custom" ? customBorderColor : secondaryBorderColors[status];
  const textColor = status === "custom" ? customTextColor : theme.text[badgeColor];

  let leftOfChevronBorderColor = textColor;
  if (status === "custom") leftOfChevronBorderColor = customBorderColor ?? textColor;
  else if (secondary) leftOfChevronBorderColor = borderColor;

  const findSelectedItem = useCallback(
    (v: string | undefined | null): FieldOption | null => {
      if (v !== undefined && v !== null) {
        return options.find((opt) => opt.value === v) || null;
      }
      return null;
    },
    [options]
  );

  const displayVal = useMemo(() => {
    return findSelectedItem(value)?.label ?? "---";
  }, [value, findSelectedItem]);

  const handleOnChange = useCallback(
    (val: string) => {
      const selectedItem = findSelectedItem(val);
      if (selectedItem) {
        onChange(selectedItem.value);
      }
      setShowPicker(false);
    },
    [findSelectedItem, onChange]
  );

  const renderPickerItems = useCallback(() => {
    return options?.map((item: any) => (
      <Picker.Item key={item.key || item.label} label={item.label} value={item.value} />
    ));
  }, [options]);

  const renderIosPicker = useCallback(() => {
    const handleValueChangeIos = (itemValue: string) => {
      setIosDisplayValue(itemValue);
    };

    const handleSave = () => {
      if (iosDisplayValue && !disabled) {
        handleOnChange(iosDisplayValue);
      } else {
        setShowPicker(false);
      }
    };

    const handleDismiss = () => {
      setShowPicker(false);
      setIosDisplayValue(value);
    };

    return (
      <Modal
        animationType="slide"
        onRequestClose={handleDismiss}
        supportedOrientations={["portrait", "landscape"]}
        transparent
        visible={showPicker}
      >
        <View style={{flex: 1, justifyContent: "flex-end"}}>
          <TouchableOpacity
            accessibilityHint="Closes the picker modal"
            accessibilityLabel="Dismiss picker modal"
            activeOpacity={1}
            onPress={handleDismiss}
            style={{flex: 1}}
          />
          <View
            style={{
              backgroundColor: theme.surface.neutralLight,
              borderTopColor: theme.border.default,
              borderTopWidth: 1,
              height: 215,
            }}
          >
            <View
              style={{
                alignItems: "center",
                backgroundColor: "#f8f8f8",
                height: 45,
                justifyContent: "center",
                width: "100%",
              }}
            >
              <TouchableOpacity
                accessibilityHint="Saves the selected value"
                accessibilityLabel="Save selected value"
                aria-role="button"
                hitSlop={{bottom: 4, left: 4, right: 4, top: 4}}
                onPress={handleSave}
                style={{
                  alignSelf: "flex-end",
                  paddingRight: 12,
                }}
              >
                <View>
                  <Text
                    style={{
                      color: "#007aff",
                      fontSize: 17,
                      fontWeight: "600",
                      paddingTop: 1,
                    }}
                  >
                    Save
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
            <Picker
              enabled={!disabled}
              onValueChange={handleValueChangeIos}
              selectedValue={iosDisplayValue}
            >
              {renderPickerItems()}
            </Picker>
          </View>
        </View>
      </Modal>
    );
  }, [showPicker, iosDisplayValue, disabled, theme, value, handleOnChange, renderPickerItems]);

  const renderPicker = useCallback(() => {
    return (
      <Picker
        enabled={!disabled}
        onValueChange={handleOnChange}
        selectedValue={findSelectedItem(value)?.value ?? undefined}
        style={[
          {
            backgroundColor: "transparent",
            color: "transparent",
            height: "100%",
            opacity: 0,
            position: "absolute",
            width: "100%",
          },
        ]}
      >
        {renderPickerItems()}
      </Picker>
    );
  }, [disabled, findSelectedItem, value, handleOnChange, renderPickerItems]);

  // Custom web dropdown. Rendering the native <Picker> on web delegates
  // styling to each browser (Safari in particular looks very different from
  // Chrome/Firefox). Instead, we render a styled popup menu anchored to the
  // badge so the dropdown looks identical across browsers.
  const webMenuOptions = useMemo<WebDropdownMenuOption[]>(
    () => options.map((item) => ({key: item.key, label: item.label, value: item.value})),
    [options]
  );

  const renderWebPicker = useCallback(() => {
    return (
      <WebDropdownMenu
        anchor={webAnchor}
        minWidth={160}
        onClose={() => setShowPicker(false)}
        onSelect={(val) => handleOnChange(val)}
        options={webMenuOptions}
        optionTextStyle={{fontFamily: "text", fontSize: 12}}
        selectedValue={value}
        testIDPrefix="web_badge"
        visible={showPicker}
        width={undefined}
      />
    );
  }, [showPicker, webAnchor, webMenuOptions, value, handleOnChange]);

  const openWebMenu = (): void => {
    if (disabled) {
      return;
    }
    measureWebAnchor(() => {
      setShowPicker(true);
    });
  };

  return (
    <View ref={webTriggerRef} style={{alignItems: "flex-start", opacity: disabled ? 0.5 : 1}}>
      <TouchableOpacity
        accessibilityHint="Opens the options picker"
        accessibilityLabel="Open select badge options"
        aria-role="button"
        disabled={disabled}
        onPress={() => {
          if (Platform.OS === "web") {
            if (showPicker) {
              setShowPicker(false);
            } else {
              openWebMenu();
            }
            return;
          }
          setShowPicker(!showPicker);
        }}
      >
        <View
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "row",
            height: 20,
            width: "auto",
          }}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor,
              borderBottomLeftRadius: 4,
              borderColor,
              borderTopLeftRadius: 4,
              borderWidth,
              flexDirection: "row",
              height: 20,
              justifyContent: "center",
              paddingHorizontal: theme.spacing.sm,
              width: "auto",
            }}
          >
            <Text
              style={{
                color: textColor,
                fontFamily: "text",
                fontSize: 10,
                fontWeight: "700",
              }}
            >
              {displayVal}
            </Text>
          </View>
          <View
            style={{
              alignItems: "center",
              backgroundColor,
              borderBottomRightRadius: 4,
              borderColor: leftOfChevronBorderColor,
              borderLeftWidth: 1,
              borderTopRightRadius: 4,
              borderWidth,
              flexDirection: "row",
              height: 20,
              justifyContent: "center",
              paddingHorizontal: theme.spacing.xs,
              paddingVertical: 1,
              width: "auto",
            }}
          >
            <Icon
              color={textColor as any}
              iconName={showPicker ? "chevron-up" : "chevron-down"}
              size="sm"
            />
          </View>
        </View>
      </TouchableOpacity>
      {Platform.OS === "ios"
        ? renderIosPicker()
        : Platform.OS === "web"
          ? renderWebPicker()
          : renderPicker()}
    </View>
  );
};
