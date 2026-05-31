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
import {
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Keyboard,
  Modal,
  type ModalProps,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  TouchableOpacity,
  View,
} from "react-native";

import {Icon} from "./Icon";
import {useTheme} from "./Theme";
import {
  scheduleAfterPaint,
  useWebDropdownAnchor,
  WebDropdownMenu,
  type WebDropdownMenuOption,
} from "./WebDropdownMenu";

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

/** A single option for the picker select component. */
export interface PickerSelectItem {
  label: string;
  value: string | number | null;
  key?: string | number;
  color?: string;
  inputLabel?: string;
}

export interface RNPickerSelectProps {
  onValueChange: (value: string | number | null, index: number) => void;
  items: PickerSelectItem[];
  value?: string | number | null;
  placeholder?: Partial<PickerSelectItem>;
  disabled?: boolean;
  itemKey?: string | number;
  children?: ReactNode;
  onOpen?: () => void;
  useNativeAndroidPickerStyle?: boolean;
  fixAndroidTouchableBug?: boolean;

  // Custom Modal props (iOS only)
  doneText?: string;
  onDonePress?: () => void;
  onUpArrow?: () => void;
  onDownArrow?: () => void;
  onClose?: () => void;

  // Modal props (iOS only)
  modalProps?: Partial<ModalProps>;

  // TextInput props
  textInputProps?: Partial<TextInputProps>;

  // Touchable Done props (iOS only)
  touchableDoneProps?: Partial<PressableProps>;

  // Touchable wrapper props
  touchableWrapperProps?: Partial<PressableProps>;

  InputAccessoryView?: ComponentType<{testID?: string}>;

  /**
   * When true the web trigger becomes a searchable text input that filters
   * dropdown options by label as the user types. Only affects web.
   * @default true
   */
  searchable?: boolean;
}

export const RNPickerSelect = ({
  onValueChange,
  value,
  items,
  placeholder,
  disabled = false,
  itemKey,
  children,
  useNativeAndroidPickerStyle = true,
  fixAndroidTouchableBug = false,
  doneText = "Done",
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
  searchable = true,
}: RNPickerSelectProps) => {
  const [showPicker, setShowPicker] = useState<boolean>(false);
  const [webSearchQuery, setWebSearchQuery] = useState("");
  const webSearchInputRef = useRef<TextInput>(null);
  const [animationType, setAnimationType] = useState<ModalProps["animationType"]>(undefined);
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
  // Skip when searchable — the trigger TextInput must stay focused for typing.
  useEffect(() => {
    if (showPicker && Platform.OS === "web" && !searchable) {
      const active = document.activeElement;
      if (active instanceof HTMLElement) {
        active.blur();
      }
    }
  }, [showPicker, searchable]);

  const options = useMemo(() => {
    if (isEqual(placeholder, {})) {
      return [...items];
    } else {
      return [placeholder, ...items];
    }
  }, [items, placeholder]);

  const getSelectedItem = useCallback(
    (key: string | number | undefined, val: string | number | null | undefined) => {
      let idx = options.findIndex((item) => {
        if (item?.key && key) {
          return isEqual(item.key, key);
        }
        return isEqual(item?.value, val);
      });
      if (idx === -1) {
        idx = 0;
      }
      return {
        idx,
        selectedItem: (options[idx] || {}) as Partial<PickerSelectItem>,
      };
    },
    [options]
  );

  const [selectedItem, setSelectedItem] = useState<Partial<PickerSelectItem>>(() => {
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

  const onValueChangeEvent = (val: string | number | null, index: number) => {
    const item = getSelectedItem(itemKey, val);
    onValueChange(val, index);
    setSelectedItem(item.selectedItem);
  };

  const onOrientationChange = ({
    nativeEvent,
  }: NativeSyntheticEvent<{orientation: "portrait" | "landscape"}>) => {
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

  const togglePicker = (animate = false, postToggleCallback?: () => void) => {
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
    return options?.map((item) => {
      if (!item) return null;
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

  const renderIcon = () => {
    // Icon only needed for iOS, web and android use default icons
    if (Platform.OS !== "ios") {
      return null;
    }

    return (
      <View style={{pointerEvents: "none"}} testID="icon_container">
        <Icon color={disabled ? "secondaryLight" : "primary"} iconName="angle-down" size="sm" />
      </View>
    );
  };

  const renderTextInputOrChildren = () => {
    if (children) {
      return <View style={{pointerEvents: "box-only"}}>{children}</View>;
    }

    const textProps = textInputProps as Partial<TextProps> | undefined;
    return (
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          pointerEvents: "box-only",
          width: "100%",
        }}
      >
        {disabled ? (
          <Text
            {...textProps}
            style={
              textProps?.style
                ? [{color: theme.text.secondaryLight, flex: 1}, textProps.style]
                : {color: theme.text.secondaryLight, flex: 1}
            }
            testID={textInputProps?.testID ?? "text_input"}
          >
            {selectedItem?.inputLabel ? selectedItem?.inputLabel : selectedItem?.label}
          </Text>
        ) : (
          <TextInput
            readOnly
            style={{color: theme.text.primary}}
            testID="text_input"
            value={selectedItem?.inputLabel ? selectedItem?.inputLabel : selectedItem?.label}
            {...textInputProps}
          />
        )}
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

  const renderAndroidHeadless = () => {
    // `View` and `Pressable` accept disjoint prop sets; the fork swaps between them to work
    // around an Android touchable bug, so we cast to a structural component type that accepts
    // the union of props actually used in JSX below.
    const Component = (fixAndroidTouchableBug ? View : Pressable) as ComponentType<{
      onPress?: PressableProps["onPress"];
      testID?: string;
      children?: ReactNode;
    }>;
    return (
      <Component onPress={onOpen} testID="android_touchable_wrapper" {...touchableWrapperProps}>
        <View>
          {renderTextInputOrChildren()}
          <Picker
            enabled={!disabled}
            onValueChange={onValueChangeEvent}
            selectedValue={selectedItem?.value}
            style={[
              // to hide native icon
              Platform.OS !== "web" ? {backgroundColor: "transparent"} : {},
              {
                color: "transparent",
                height: "100%",
                opacity: 0,
                position: "absolute",
                width: "100%",
              },
            ]}
            testID="android_picker_headless"
          >
            {renderPickerItems()}
          </Picker>
        </View>
      </Component>
    );
  };

  const renderAndroidNativePickerStyle = () => {
    return (
      <View
        style={[
          defaultStyles.viewContainer,
          {
            backgroundColor: theme.surface.base,
            borderColor: theme.border.dark,
            height: 40,
          },
          disabled && {
            backgroundColor: theme.surface.neutralLight,
          },
        ]}
      >
        <Picker
          dropdownIconColor={theme.text.primary}
          enabled={!disabled}
          onValueChange={onValueChangeEvent}
          selectedValue={selectedItem?.value}
          style={[{color: theme.text.primary, width: "100%"}]}
          testID="android_picker"
        >
          {renderPickerItems()}
        </Picker>
      </View>
    );
  };

  // Custom web dropdown. Rendering the native <Picker> on web delegates
  // styling to each browser (Safari in particular looks very different from
  // Chrome/Firefox). Instead, we render a styled trigger + popup menu so the
  // dropdown looks identical across browsers and matches the Terreno design.
  const openWebMenu = useCallback(
    (initialSearchQuery = ""): void => {
      if (disabled) {
        return;
      }
      measureWebAnchor(() => {
        setWebSearchQuery(initialSearchQuery);
        setShowPicker(true);
        if (searchable && Platform.OS === "web") {
          scheduleAfterPaint(() => {
            webSearchInputRef.current?.focus();
          });
        }
        if (onOpen) {
          onOpen();
        }
      });
    },
    [disabled, measureWebAnchor, onOpen, searchable]
  );

  const closeWebMenu = (): void => {
    setShowPicker(false);
    setWebSearchQuery("");
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

  const {filteredWebMenuOptions, filteredWebMenuOptionIndexes} = useMemo<{
    filteredWebMenuOptions: WebDropdownMenuOption[];
    filteredWebMenuOptionIndexes: number[];
  }>(() => {
    const normalizedQuery = webSearchQuery.trim().toLowerCase();
    if (!searchable || normalizedQuery.length === 0) {
      return {
        filteredWebMenuOptionIndexes: webMenuOptionIndexes,
        filteredWebMenuOptions: webMenuOptions,
      };
    }

    const filteredWebMenuOptions: WebDropdownMenuOption[] = [];
    const filteredWebMenuOptionIndexes: number[] = [];
    for (let i = 0; i < webMenuOptions.length; i++) {
      const item = webMenuOptions[i];
      if (item.label.toLowerCase().includes(normalizedQuery)) {
        filteredWebMenuOptions.push(item);
        filteredWebMenuOptionIndexes.push(webMenuOptionIndexes[i] ?? i);
      }
    }
    return {filteredWebMenuOptionIndexes, filteredWebMenuOptions};
  }, [searchable, webMenuOptionIndexes, webMenuOptions, webSearchQuery]);

  const handleWebSearchChange = useCallback(
    (text: string): void => {
      if (!showPicker && !disabled) {
        openWebMenu(text);
        return;
      }
      setWebSearchQuery(text);
    },
    [disabled, openWebMenu, showPicker]
  );

  const handleWebSearchFocus = useCallback((): void => {
    if (!disabled && !showPicker) {
      openWebMenu();
    }
  }, [disabled, openWebMenu, showPicker]);

  const renderWeb = () => {
    const displayLabel = selectedItem?.inputLabel ?? selectedItem?.label ?? "";
    const selectedOriginalIdx = getSelectedItem(itemKey, value).idx;
    const webSelectedIndex = filteredWebMenuOptionIndexes.indexOf(selectedOriginalIdx);
    const triggerTextStyle = {
      color: disabled ? theme.text.secondaryLight : theme.text.primary,
      flex: 1,
      fontSize: 14,
      paddingRight: 8,
      ...(Platform.OS === "web" ? {outline: "none"} : {}),
    };

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
        {searchable ? (
          <View
            style={{
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "space-between",
              minHeight: 40,
              paddingHorizontal: 8,
              width: "100%",
            }}
            testID="web_picker"
          >
            <TextInput
              editable={!disabled}
              onChangeText={handleWebSearchChange}
              onFocus={handleWebSearchFocus}
              placeholder={showPicker ? "Search..." : undefined}
              placeholderTextColor={theme.text.secondaryLight}
              ref={webSearchInputRef}
              style={triggerTextStyle}
              testID="text_input"
              value={showPicker ? webSearchQuery : displayLabel}
              {...textInputProps}
            />
            <Pressable
              aria-role="button"
              disabled={disabled}
              onPress={showPicker ? closeWebMenu : () => openWebMenu()}
              {...touchableWrapperProps}
            >
              <Icon
                color={disabled ? "secondaryLight" : "primary"}
                iconName={showPicker ? "angle-up" : "angle-down"}
                size="sm"
              />
            </Pressable>
          </View>
        ) : (
          <Pressable
            aria-role="button"
            disabled={disabled}
            onPress={() => openWebMenu()}
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
              numberOfLines={disabled ? undefined : 1}
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
        )}
        <WebDropdownMenu
          anchor={webAnchor}
          onClose={closeWebMenu}
          onSelect={(_val, idx) => {
            const originalIndex = filteredWebMenuOptionIndexes[idx] ?? idx;
            // Pass the original (non-stringified) value through so lodash
            // `isEqual` matching in `getSelectedItem` works for number /
            // object values.
            const originalValue = options[originalIndex]?.value ?? null;
            onValueChangeEvent(originalValue, originalIndex);
            closeWebMenu();
          }}
          options={filteredWebMenuOptions}
          searchable={false}
          selectedIndex={webSelectedIndex >= 0 ? webSelectedIndex : undefined}
          showEmptyStateWhenNoOptions={searchable && webSearchQuery.trim().length > 0}
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

    if (children || !useNativeAndroidPickerStyle) {
      return renderAndroidHeadless();
    }

    return renderAndroidNativePickerStyle();
  };

  return render();
};
