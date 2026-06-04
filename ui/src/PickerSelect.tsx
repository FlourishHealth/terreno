// MIT License

// Copyright (c) LawnStarter

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Forked 2021/11/26 by Josh Gachnang <josh@nang.io> from version 8.0.3 because it conflicted
// with react-native-picker in Expo, then converted to TS.

import {Picker} from "@react-native-picker/picker";
import isEqual from "lodash/isEqual";
import {useCallback, useEffect, useMemo, useState} from "react";
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import {Icon} from "./Icon";
import {useTheme} from "./Theme";
import {useWebDropdownAnchor, WebDropdownMenu, type WebDropdownMenuOption} from "./WebDropdownMenu";

export const defaultStyles = StyleSheet.create({
  chevron: {
    backgroundColor: "transparent",
    borderColor: "#a1a1a1",
    borderRightWidth: 1.5,
    borderTopWidth: 1.5,
    height: 15,
    width: 15,
  },

  chevronActive: {
    borderColor: "#007aff",
  },
  viewContainer: {
    alignItems: "center",
    alignSelf: "stretch",
    borderRadius: 4,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 40,
    width: "100%",
  },
});

export interface RNPickerSelectProps {
  onValueChange: (value: any, index: any) => void;
  items: any[];
  value?: any;
  placeholder?: any;
  disabled?: boolean;
  itemKey?: string | number;
  children?: any;
  onOpen?: () => void;
  useNativeAndroidPickerStyle?: boolean;
  fixAndroidTouchableBug?: boolean;
  /** Enable type-to-filter search in the web dropdown. */
  searchable?: boolean;

  // Custom Modal props (iOS and Android)
  doneText?: string;
  cancelText?: string;
  onDonePress?: () => void;
  onUpArrow?: () => void;
  onDownArrow?: () => void;
  onClose?: () => void;

  // Modal props (iOS and Android)
  modalProps?: any;

  // TextInput props
  textInputProps?: any;

  // Touchable Done props (iOS only)
  touchableDoneProps?: any;

  // Touchable wrapper props
  touchableWrapperProps?: any;

  InputAccessoryView?: any;
}

export function RNPickerSelect({
  onValueChange,
  value,
  items,
  placeholder,
  disabled = false,
  itemKey,
  children,
  useNativeAndroidPickerStyle = true,
  fixAndroidTouchableBug = false,
  searchable = false,
  doneText = "Done",
  cancelText = "Cancel",
  onDonePress,
  onUpArrow,
  onDownArrow,
  onOpen,
  onClose,
  modalProps,
  textInputProps,
  touchableDoneProps,
  touchableWrapperProps,

  InputAccessoryView,
}: RNPickerSelectProps) {
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [animationType, setAnimationType] = useState(undefined);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [doneDepressed, setDoneDepressed] = useState<boolean>(false);
  const {theme} = useTheme();

  // Web-only: anchor the custom dropdown menu to the trigger element so that
  // Safari/Firefox/Chrome all render the same styled menu instead of the
  // browser's native <select> UI.
  const {
    anchor: webAnchor,
    measure: measureWebAnchor,
    triggerRef: webTriggerRef,
  } = useWebDropdownAnchor();

  // On web, blur the active element before the picker modal opens to prevent
  // "aria-hidden on a focused element" warnings from React Native Web.
  useEffect(() => {
    if (showPicker && Platform.OS === "web") {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    }
  }, [showPicker]);

  const options = useMemo(() => {
    if (isEqual(placeholder, {})) {
      return [...items];
    } else {
      return [placeholder, ...items];
    }
  }, [items, placeholder]);

  const getSelectedItem = useCallback(
    (key: any, val: any) => {
      let idx = options.findIndex((item: any) => {
        if (item.key && key) {
          return isEqual(item.key, key);
        }
        return isEqual(item.value, val);
      });
      if (idx === -1) {
        idx = 0;
      }
      return {
        idx,
        selectedItem: options[idx] || {},
      };
    },
    [options]
  );

  const [selectedItem, setSelectedItem] = useState<any>(() => {
    return getSelectedItem(itemKey, value).selectedItem;
  });

  // Set selected item
  useEffect(() => {
    const item = getSelectedItem(itemKey, value);
    setSelectedItem(item.selectedItem);
  }, [getSelectedItem, itemKey, value]);

  const onUpArrowEvent = () => {
    togglePicker(false, onUpArrow);
  };

  const onDownArrowEvent = () => {
    togglePicker(false, onDownArrow);
  };

  const onValueChangeEvent = (val: any, index: any) => {
    const item = getSelectedItem(itemKey, val);
    onValueChange(val, index);
    setSelectedItem(item.selectedItem);
  };

  const onOrientationChange = ({nativeEvent}: any) => {
    setOrientation(nativeEvent.orientation);
  };

  const triggerOpenCloseCallbacks = () => {
    if (!showPicker && onOpen) {
      onOpen();
    }

    if (showPicker && onClose) {
      onClose();
    }
  };

  const togglePicker = (animate = false, postToggleCallback?: any) => {
    if (disabled) {
      return;
    }

    if (!showPicker) {
      Keyboard.dismiss();
    }

    setAnimationType(modalProps?.animationType ? modalProps?.animationType : "slide");

    triggerOpenCloseCallbacks();

    setAnimationType(animate ? animationType : undefined);
    setShowPicker(!showPicker);

    if (postToggleCallback) {
      postToggleCallback();
    }
  };

  const renderPickerItems = () => {
    return options?.map((item: any) => {
      return (
        <Picker.Item
          color={item.color}
          key={item.key || item.label}
          label={item.label}
          value={item.value}
        />
      );
    });
  };

  const renderInputAccessoryView = () => {
    if (InputAccessoryView) {
      return <InputAccessoryView testID="custom_input_accessory_view" />;
    }

    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: "#f8f8f8",
          borderTopColor: "#dedede",
          borderTopWidth: 1,
          flexDirection: "row",
          height: 45,
          justifyContent: "space-between",
          paddingHorizontal: 10,
          zIndex: 2,
        }}
        testID="input_accessory_view"
      >
        <View
          style={{
            flexDirection: "row",
          }}
        >
          {Boolean(onUpArrow) && (
            <TouchableOpacity
              activeOpacity={onUpArrow ? 0.5 : 1}
              aria-role="button"
              onPress={onUpArrow ? onUpArrowEvent : undefined}
            >
              <View
                // chevron up
                style={[
                  defaultStyles.chevron,
                  {
                    marginLeft: 11,
                    transform: [{translateY: 4}, {rotate: "-45deg"}],
                  },
                  onUpArrow ? [defaultStyles.chevronActive] : {},
                ]}
              />
            </TouchableOpacity>
          )}
          {Boolean(onDownArrow) && (
            <TouchableOpacity
              activeOpacity={onDownArrow ? 0.5 : 1}
              aria-role="button"
              onPress={onDownArrow ? onDownArrowEvent : undefined}
            >
              <View
                // chevron down
                style={[
                  defaultStyles.chevron,
                  {
                    marginLeft: 22,
                    transform: [{translateY: -5}, {rotate: "135deg"}],
                  },
                  onDownArrow ? [defaultStyles.chevronActive] : {},
                ]}
              />
            </TouchableOpacity>
          )}
        </View>
        <Pressable
          hitSlop={{bottom: 4, left: 4, right: 4, top: 4}}
          onPress={() => {
            togglePicker(true, onDonePress);
          }}
          onPressIn={() => {
            setDoneDepressed(true);
          }}
          onPressOut={() => {
            setDoneDepressed(false);
          }}
          testID="done_button"
          {...touchableDoneProps}
        >
          <View testID="needed_for_touchable">
            <Text
              allowFontScaling={false}
              style={[
                {
                  color: "#007aff",
                  fontSize: 17,
                  fontWeight: "600",
                  paddingRight: 11,
                  paddingTop: 1,
                },
                doneDepressed
                  ? {
                      fontSize: 19,
                    }
                  : {},
              ]}
              testID="done_text"
            >
              {doneText}
            </Text>
          </View>
        </Pressable>
      </View>
    );
  };

  const renderIcon = (): React.ReactNode => {
    if (Platform.OS !== "ios" && Platform.OS !== "android") {
      return null;
    }

    return (
      <View style={{pointerEvents: "none"}} testID="icon_container">
        <Icon
          color={disabled ? "secondaryLight" : "primary"}
          iconName={showPicker && Platform.OS === "android" ? "angle-up" : "angle-down"}
          size="sm"
        />
      </View>
    );
  };

  const openAndroidPicker = (): void => {
    if (disabled) {
      return;
    }

    Keyboard.dismiss();
    if (onOpen) {
      onOpen();
    }
    setShowPicker(true);
  };

  const closeAndroidPicker = (): void => {
    if (!showPicker) {
      return;
    }

    if (onClose) {
      onClose();
    }
    setShowPicker(false);
  };

  const selectAndroidOption = (val: any, index: number): void => {
    onValueChangeEvent(val, index);
    if (onClose) {
      onClose();
    }
    setShowPicker(false);
  };

  const renderAndroidOptionList = (): React.ReactNode => {
    const selectedOriginalIdx = getSelectedItem(itemKey, value).idx;

    return (
      <ScrollView keyboardShouldPersistTaps="handled" testID="android_picker_list">
        {options.map((item: any, index: number) => {
          if (!item || typeof item !== "object" || typeof item.label !== "string") {
            return null;
          }

          const isSelected = index === selectedOriginalIdx;

          return (
            <Pressable
              aria-role="button"
              key={item.key ?? index}
              onPress={() => {
                selectAndroidOption(item.value, index);
              }}
              style={{
                backgroundColor: isSelected ? theme.surface.neutralLight : theme.surface.base,
                paddingHorizontal: 16,
                paddingVertical: 14,
              }}
              testID={`android_picker_option_${index}`}
            >
              <Text
                style={{
                  color: item.color ?? theme.text.primary,
                  fontSize: 16,
                  fontWeight: isSelected ? "600" : "400",
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  };

  const renderAndroidModal = (): React.ReactNode => {
    return (
      <Modal
        animationType="fade"
        onRequestClose={closeAndroidPicker}
        testID="android_modal"
        transparent
        visible={showPicker}
        {...modalProps}
      >
        <Pressable
          aria-role="button"
          onPress={closeAndroidPicker}
          style={{
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            flex: 1,
            justifyContent: "flex-end",
          }}
          testID="android_modal_backdrop"
        >
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
            }}
            style={{
              backgroundColor: theme.surface.base,
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              maxHeight: "70%",
              overflow: "hidden",
            }}
            testID="android_modal_sheet"
          >
            <View
              style={{
                alignItems: "center",
                borderBottomColor: theme.border.dark,
                borderBottomWidth: 1,
                flexDirection: "row",
                justifyContent: "flex-start",
                minHeight: 48,
                paddingHorizontal: 12,
              }}
              testID="android_input_accessory_view"
            >
              <Pressable
                hitSlop={{bottom: 8, left: 8, right: 8, top: 8}}
                onPress={closeAndroidPicker}
                testID="cancel_button"
              >
                <Text
                  allowFontScaling={false}
                  style={{
                    color: "#007aff",
                    fontSize: 17,
                    fontWeight: "600",
                    paddingHorizontal: 4,
                  }}
                  testID="cancel_text"
                >
                  {cancelText}
                </Text>
              </Pressable>
            </View>
            {renderAndroidOptionList()}
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const renderAndroidTrigger = (): React.ReactNode => {
    if (children) {
      const Component: any = fixAndroidTouchableBug ? View : Pressable;
      return (
        <Component
          activeOpacity={1}
          onPress={openAndroidPicker}
          testID="android_touchable_wrapper"
          {...touchableWrapperProps}
        >
          <View style={{pointerEvents: "box-only"}}>{children}</View>
        </Component>
      );
    }

    return (
      <Pressable
        activeOpacity={1}
        disabled={disabled}
        onPress={openAndroidPicker}
        style={{
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "space-between",
          minHeight: 40,
          paddingHorizontal: 8,
          width: "100%",
        }}
        testID="android_touchable_wrapper"
        {...touchableWrapperProps}
      >
        <TextInput
          pointerEvents="none"
          readOnly
          style={{
            color: disabled ? theme.text.secondaryLight : theme.text.primary,
            flex: 1,
            paddingRight: 8,
          }}
          testID="text_input"
          value={selectedItem?.inputLabel ? selectedItem?.inputLabel : selectedItem?.label}
          {...textInputProps}
        />
        {renderIcon()}
      </Pressable>
    );
  };

  const renderAndroid = (): React.ReactNode => {
    const isHeadless = Boolean(children) || !useNativeAndroidPickerStyle;

    return (
      <View
        style={
          isHeadless
            ? undefined
            : [
                defaultStyles.viewContainer,
                {
                  backgroundColor: theme.surface.base,
                  borderColor: theme.border.dark,
                  height: 40,
                },
                disabled && {
                  backgroundColor: theme.surface.neutralLight,
                },
              ]
        }
      >
        {renderAndroidTrigger()}
        {renderAndroidModal()}
      </View>
    );
  };

  const renderTextInputOrChildren = () => {
    if (children) {
      return <View style={{pointerEvents: "box-only"}}>{children}</View>;
    }

    return (
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          pointerEvents: "box-only",
          width: "100%",
        }}
      >
        <TextInput
          readOnly
          style={{color: disabled ? theme.text.secondaryLight : theme.text.primary}}
          testID="text_input"
          value={selectedItem?.inputLabel ? selectedItem?.inputLabel : selectedItem?.label}
          {...textInputProps}
        />
        {renderIcon()}
      </View>
    );
  };

  const renderIOS = () => {
    return (
      <View
        style={[
          defaultStyles.viewContainer,
          {
            backgroundColor: theme.surface.base,
            borderColor: theme.border.dark,
          },
          disabled && {
            backgroundColor: theme.surface.neutralLight,
          },
        ]}
      >
        <Pressable
          activeOpacity={1}
          onPress={() => {
            togglePicker(true);
          }}
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            minHeight: 40,
            width: "95%",
          }}
          testID="ios_touchable_wrapper"
          {...touchableWrapperProps}
        >
          {renderTextInputOrChildren()}
        </Pressable>
        <Modal
          animationType={animationType}
          onOrientationChange={onOrientationChange}
          supportedOrientations={["portrait", "landscape"]}
          testID="ios_modal"
          transparent
          visible={showPicker}
          {...modalProps}
        >
          <Pressable
            aria-role="button"
            onPress={() => {
              togglePicker(true);
            }}
            style={{
              flex: 1,
            }}
            testID="ios_modal_top"
          />
          {renderInputAccessoryView()}
          <View
            style={[
              {
                backgroundColor: "#d0d4da",
                justifyContent: "center",
              },
              {height: orientation === "portrait" ? 215 : 162},
            ]}
          >
            <Picker
              onValueChange={onValueChangeEvent}
              selectedValue={selectedItem?.value}
              testID="ios_picker"
            >
              {renderPickerItems()}
            </Picker>
          </View>
        </Modal>
      </View>
    );
  };

  // Custom web dropdown. Rendering the native <Picker> on web delegates
  // styling to each browser (Safari in particular looks very different from
  // Chrome/Firefox). Instead, we render a styled trigger + popup menu so the
  // dropdown looks identical across browsers and matches the Terreno design.
  const openWebMenu = (): void => {
    if (disabled) {
      return;
    }
    measureWebAnchor(() => {
      setShowPicker(true);
      if (onOpen) {
        onOpen();
      }
    });
  };

  const closeWebMenu = (): void => {
    setShowPicker(false);
    if (onClose) {
      onClose();
    }
  };

  // Build the dropdown option list AND track each option's original index in
  // `options` so `onValueChange` receives the same index that the native
  // Picker would have reported (needed when a placeholder is present).
  const {menuOptions: webMenuOptions, originalIndexes: webMenuOptionIndexes} = useMemo<{
    menuOptions: WebDropdownMenuOption[];
    originalIndexes: number[];
  }>(() => {
    const menuOptions: WebDropdownMenuOption[] = [];
    const originalIndexes: number[] = [];
    for (let i = 0; i < options.length; i++) {
      const item = options[i];
      if (!item || typeof item !== "object" || typeof item.label !== "string") {
        continue;
      }
      menuOptions.push({
        color: item.color,
        key: item.key,
        label: item.label,
        value: String(item.value ?? ""),
      });
      originalIndexes.push(i);
    }
    return {menuOptions, originalIndexes};
  }, [options]);

  const renderWeb = () => {
    const displayLabel = selectedItem?.inputLabel ?? selectedItem?.label ?? "";
    const selectedOriginalIdx = getSelectedItem(itemKey, value).idx;
    const webSelectedIndex = webMenuOptionIndexes.indexOf(selectedOriginalIdx);
    return (
      <View
        ref={webTriggerRef}
        style={[
          defaultStyles.viewContainer,
          {
            backgroundColor: theme.surface.base,
            borderColor: theme.border.dark,
          },
          disabled && {
            backgroundColor: theme.surface.neutralLight,
          },
        ]}
      >
        <Pressable
          aria-role="button"
          disabled={disabled}
          onPress={openWebMenu}
          style={{
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "space-between",
            minHeight: 40,
            paddingHorizontal: 8,
            width: "100%",
          }}
          testID="web_picker"
          {...touchableWrapperProps}
        >
          <Text
            numberOfLines={1}
            style={{
              color: disabled ? theme.text.secondaryLight : theme.text.primary,
              flex: 1,
              paddingRight: 8,
            }}
            testID="text_input"
          >
            {displayLabel}
          </Text>
          <Icon
            color={disabled ? "secondaryLight" : "primary"}
            iconName={showPicker ? "angle-up" : "angle-down"}
            size="sm"
          />
        </Pressable>
        <WebDropdownMenu
          anchor={webAnchor}
          onClose={closeWebMenu}
          onSelect={(_val, idx) => {
            const originalIndex = webMenuOptionIndexes[idx] ?? idx;
            // Pass the original (non-stringified) value through so lodash
            // `isEqual` matching in `getSelectedItem` works for number /
            // object values.
            const originalValue = options[originalIndex]?.value;
            onValueChangeEvent(originalValue, originalIndex);
            closeWebMenu();
          }}
          options={webMenuOptions}
          searchable={searchable}
          selectedIndex={webSelectedIndex >= 0 ? webSelectedIndex : undefined}
          testIDPrefix="web_dropdown"
          visible={showPicker}
        />
      </View>
    );
  };

  const render = () => {
    if (Platform.OS === "ios") {
      return renderIOS();
    }

    if (Platform.OS === "web") {
      return renderWeb();
    }

    return renderAndroid();
  };

  return render();
}
